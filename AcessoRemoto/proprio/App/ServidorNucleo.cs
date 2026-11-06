using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using AcessoRemoto.Comum;

namespace AcessoRemoto;

sealed class Maquina
{
    public string Id { get; set; } = "";
    public string Sal { get; set; } = "";
    public string Hash { get; set; } = "";
    public Ligacao? Cliente;
    public Ligacao? Tecnico;
    public readonly object Trava = new();
}

sealed class Ligacao
{
    public Stream Fluxo { get; }
    public SemaphoreSlim Envio { get; } = new(1, 1);
    public TcpClient Tcp { get; }

    public Ligacao(TcpClient tcp, Stream fluxo)
    {
        Tcp = tcp;
        Fluxo = fluxo;
    }

    public async Task EnviarAsync(byte tipo, ReadOnlyMemory<byte> dados, CancellationToken ct, bool descartarSeOcupado = false)
    {
        if (descartarSeOcupado)
        {
            if (!await Envio.WaitAsync(0, ct)) return;
        }
        else
        {
            await Envio.WaitAsync(ct);
        }
        try
        {
            await Pacote.EnviarAsync(Fluxo, tipo, dados, ct);
        }
        finally
        {
            Envio.Release();
        }
    }

    public void Fechar()
    {
        try { Fluxo.Dispose(); } catch { }
        try { Tcp.Close(); } catch { }
    }
}

sealed class ServidorNucleo
{
    readonly ConcurrentDictionary<string, Maquina> _maquinas = new();
    readonly string _pastaDados;
    readonly string _arquivoCadastro;
    readonly object _arquivo = new();
    X509Certificate2? _cert;
    TcpListener? _ouvinte;
    public int Porta { get; } = 47200;
    public string Impressao { get; private set; } = "";
    public Action<string>? Log;
    public Action<string>? IpSugerido;

    public ServidorNucleo(string pastaExe)
    {
        _pastaDados = Path.Combine(pastaExe, "data");
        _arquivoCadastro = Path.Combine(_pastaDados, "cadastro.json");
        Directory.CreateDirectory(_pastaDados);
        Carregar();
    }

    public async Task RodarAsync(CancellationToken ct)
    {
        _cert = CarregarCertificado();
        Impressao = Convert.ToHexString(SHA256.HashData(_cert.RawData));
        GravarConfTecnico();
        LiberarPorta();
        _ouvinte = new TcpListener(IPAddress.Any, Porta);
        _ouvinte.Start();
        Log?.Invoke("Servidor no ar na porta " + Porta + ". Deixe esta janela aberta.");
        var lan = IpsLocais().FirstOrDefault() ?? "127.0.0.1";
        Log?.Invoke("IP dentro da empresa: " + lan);
        _ = PrepararInternetAsync(lan, ct);
        try
        {
            while (!ct.IsCancellationRequested)
            {
                var tcp = await _ouvinte.AcceptTcpClientAsync(ct);
                tcp.NoDelay = true;
                _ = Task.Run(() => AtenderAsync(tcp, ct));
            }
        }
        catch (OperationCanceledException) { }
        finally
        {
            _ouvinte.Stop();
        }
    }

    void GravarConfTecnico()
    {
        GravarConf(Path.Combine(Program.PastaExe(), "..", "02-tecnico", "servidor.conf"), "127.0.0.1");
        Log?.Invoke("O programa do tecnico, neste computador, usa 127.0.0.1.");
    }

    public void GravarIpCliente(string ip)
    {
        ip = (ip ?? "").Trim();
        if (!IPAddress.TryParse(ip, out var endereco) || endereco.AddressFamily != AddressFamily.InterNetwork)
        {
            Log?.Invoke("IP invalido. Use so o numero, por exemplo 203.0.113.10.");
            return;
        }
        GravarConf(Path.Combine(Program.PastaExe(), "..", "03-cliente", "servidor.conf"), ip);
        Log?.Invoke("IP gravado na pasta do cliente: " + ip + ". Copie a pasta 03-cliente agora.");
        if (!PortaInternet.IpPublicoUtil(ip))
            Log?.Invoke("Esse IP e da rede interna. O cliente em outra internet nao alcanca esse numero.");
    }

    void GravarConf(string caminho, string ip)
    {
        ConfLocal.Gravar(caminho, new[]
        {
            "IP=" + ip,
            "PORTA=" + Porta,
            "IMPRESSAO=" + Impressao
        });
    }

    async Task PrepararInternetAsync(string lan, CancellationToken ct)
    {
        var (ip, abriu, detalhe) = await PortaInternet.AbrirAsync(Porta, lan, ct);
        Log?.Invoke(detalhe);
        string? publico = PortaInternet.IpPublicoUtil(ip) ? ip : null;
        if (publico == null)
        {
            var visto = await PortaInternet.DescobrirIpAsync(ct);
            if (PortaInternet.IpPublicoUtil(visto)) publico = visto;
            else if (!string.IsNullOrWhiteSpace(visto))
                Log?.Invoke("A internet da empresa esta atras de outra rede (" + visto + "). A operadora precisa entregar um IP publico.");
        }
        if (publico == null)
        {
            Log?.Invoke("Digite o IP publico da empresa na caixa acima e clique em Gravar.");
            return;
        }
        IpSugerido?.Invoke(publico);
        GravarIpCliente(publico);
        if (!abriu)
            Log?.Invoke("No roteador da empresa, encaminhe a porta " + Porta + "/tcp para " + lan + ".");
    }

    static void LiberarPorta()
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "netsh",
                Arguments = "advfirewall firewall add rule name=\"AcessoRemoto 47200\" dir=in action=allow protocol=TCP localport=47200",
                CreateNoWindow = true,
                UseShellExecute = false
            });
        }
        catch { }
    }

    static List<string> IpsLocais()
    {
        var lista = new List<string>();
        try
        {
            foreach (var placa in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (placa.OperationalStatus != OperationalStatus.Up) continue;
                if (placa.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                var desc = placa.Description.ToLowerInvariant();
                if (desc.Contains("virtual") || desc.Contains("hyper-v") || desc.Contains("wsl") || desc.Contains("vmware") || desc.Contains("virtualbox")) continue;
                foreach (var uni in placa.GetIPProperties().UnicastAddresses)
                {
                    if (uni.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                    var texto = uni.Address.ToString();
                    if (texto.StartsWith("127.") || texto.StartsWith("169.254.")) continue;
                    lista.Add(texto);
                }
            }
        }
        catch { }
        lista.Sort((a, b) => Preferencia(a).CompareTo(Preferencia(b)));
        return lista.Distinct().ToList();
    }

    static int Preferencia(string ip)
    {
        if (ip.StartsWith("192.168.")) return 0;
        if (ip.StartsWith("10.")) return 1;
        if (ip.StartsWith("172.")) return 2;
        return 3;
    }

    X509Certificate2 CarregarCertificado()
    {
        var pfx = Path.Combine(_pastaDados, "servidor.pfx");
        var senhaArq = Path.Combine(_pastaDados, "servidor.pfx.senha");
        var marca = Path.Combine(_pastaDados, "cert-v2.txt");
        if (!File.Exists(marca))
        {
            if (File.Exists(pfx)) File.Delete(pfx);
            if (File.Exists(senhaArq)) File.Delete(senhaArq);
        }
        if (File.Exists(pfx) && File.Exists(senhaArq))
        {
            var senha = File.ReadAllText(senhaArq).Trim();
            return new X509Certificate2(pfx, senha, X509KeyStorageFlags.Exportable | X509KeyStorageFlags.EphemeralKeySet);
        }
        using var rsa = RSA.Create(2048);
        var pedido = new CertificateRequest("CN=AcessoRemoto", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        pedido.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
        pedido.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
        var usos = new OidCollection { new Oid("1.3.6.1.5.5.7.3.1") };
        pedido.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(usos, false));
        var cert = pedido.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddYears(10));
        var senhaNova = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        File.WriteAllBytes(pfx, cert.Export(X509ContentType.Pfx, senhaNova));
        File.WriteAllText(senhaArq, senhaNova);
        File.WriteAllText(marca, "ok");
        return new X509Certificate2(pfx, senhaNova, X509KeyStorageFlags.Exportable | X509KeyStorageFlags.EphemeralKeySet);
    }

    async Task AtenderAsync(TcpClient tcp, CancellationToken ct)
    {
        Ligacao? ligacao = null;
        try
        {
            var ssl = new SslStream(tcp.GetStream(), false);
            await ssl.AuthenticateAsServerAsync(new SslServerAuthenticationOptions
            {
                ServerCertificate = _cert!,
                ClientCertificateRequired = false,
                EnabledSslProtocols = System.Security.Authentication.SslProtocols.Tls12 | System.Security.Authentication.SslProtocols.Tls13
            }, ct);
            ligacao = new Ligacao(tcp, ssl);
            var primeiro = await Pacote.LerAsync(ssl, ct);
            if (primeiro == null) return;
            if (primeiro.Value.Tipo == Tipos.Registrar)
                await LoopClienteAsync(ligacao, Mensagens.LerTexto(primeiro.Value.Dados), ct);
            else if (primeiro.Value.Tipo == Tipos.Entrar)
                await LoopTecnicoAsync(ligacao, Mensagens.LerTexto(primeiro.Value.Dados), ct);
            else
                await ligacao.EnviarAsync(Tipos.Erro, Mensagens.Texto(new Aviso { Mensagem = "Pedido invalido." }), ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            Log?.Invoke("Conexao encerrada: " + ex.Message);
        }
        finally
        {
            ligacao?.Fechar();
        }
    }

    async Task LoopClienteAsync(Ligacao ligacao, Aviso pedido, CancellationToken ct)
    {
        var maquina = ObterOuCriar(pedido);
        if (maquina == null)
        {
            await ligacao.EnviarAsync(Tipos.Erro, Mensagens.Texto(new Aviso { Mensagem = "Senha nao confere com este ID." }), ct);
            return;
        }
        lock (maquina.Trava)
        {
            maquina.Cliente?.Fechar();
            maquina.Cliente = ligacao;
        }
        await ligacao.EnviarAsync(Tipos.Registrado, Mensagens.Texto(new Aviso { Id = maquina.Id }), ct);
        Log?.Invoke("Cliente conectado. ID " + maquina.Id);
        if (maquina.Tecnico != null)
            await ligacao.EnviarAsync(Tipos.TecnicoEntrou, Array.Empty<byte>(), ct);

        while (!ct.IsCancellationRequested)
        {
            var pacote = await Pacote.LerAsync(ligacao.Fluxo, ct);
            if (pacote == null) break;
            if (pacote.Value.Tipo != Tipos.Frame) continue;
            Ligacao? tecnico;
            lock (maquina.Trava) tecnico = maquina.Tecnico;
            if (tecnico == null) continue;
            try
            {
                await tecnico.EnviarAsync(Tipos.Frame, pacote.Value.Dados, ct, descartarSeOcupado: true);
            }
            catch
            {
                lock (maquina.Trava)
                {
                    if (ReferenceEquals(maquina.Tecnico, tecnico)) maquina.Tecnico = null;
                }
            }
        }
        lock (maquina.Trava)
        {
            if (ReferenceEquals(maquina.Cliente, ligacao)) maquina.Cliente = null;
        }
        Log?.Invoke("Cliente saiu. ID " + maquina.Id);
    }

    async Task LoopTecnicoAsync(Ligacao ligacao, Aviso pedido, CancellationToken ct)
    {
        if (!_maquinas.TryGetValue(pedido.Id.Trim(), out var maquina) || !SenhaConfere(maquina, pedido.Senha))
        {
            await ligacao.EnviarAsync(Tipos.Erro, Mensagens.Texto(new Aviso { Mensagem = "ID ou senha nao confere." }), ct);
            return;
        }
        lock (maquina.Trava)
        {
            if (maquina.Tecnico != null)
            {
                maquina.Tecnico.Fechar();
            }
            maquina.Tecnico = ligacao;
        }
        await ligacao.EnviarAsync(Tipos.Ok, Array.Empty<byte>(), ct);
        Ligacao? cliente;
        lock (maquina.Trava) cliente = maquina.Cliente;
        if (cliente != null)
        {
            try { await cliente.EnviarAsync(Tipos.TecnicoEntrou, Array.Empty<byte>(), ct); }
            catch { }
        }
        Log?.Invoke("Tecnico entrou no ID " + maquina.Id);

        while (!ct.IsCancellationRequested)
        {
            var pacote = await Pacote.LerAsync(ligacao.Fluxo, ct);
            if (pacote == null) break;
            if (pacote.Value.Tipo is not (Tipos.Mouse or Tipos.Tecla)) continue;
            lock (maquina.Trava) cliente = maquina.Cliente;
            if (cliente == null) continue;
            try
            {
                await cliente.EnviarAsync(pacote.Value.Tipo, pacote.Value.Dados, ct);
            }
            catch
            {
                lock (maquina.Trava)
                {
                    if (ReferenceEquals(maquina.Cliente, cliente)) maquina.Cliente = null;
                }
            }
        }
        lock (maquina.Trava)
        {
            if (ReferenceEquals(maquina.Tecnico, ligacao)) maquina.Tecnico = null;
            cliente = maquina.Cliente;
        }
        if (cliente != null)
        {
            try { await cliente.EnviarAsync(Tipos.TecnicoSaiu, Array.Empty<byte>(), ct); }
            catch { }
        }
        Log?.Invoke("Tecnico saiu do ID " + maquina.Id);
    }

    Maquina? ObterOuCriar(Aviso pedido)
    {
        var id = (pedido.Id ?? "").Trim();
        var senha = pedido.Senha ?? "";
        if (id.Length > 0 && _maquinas.TryGetValue(id, out var existente))
        {
            if (!SenhaConfere(existente, senha)) return null;
            return existente;
        }
        if (senha.Length < 6) return null;
        var escolhido = id.Length == 9 && id.All(char.IsDigit) && id[0] != '0' && !_maquinas.ContainsKey(id)
            ? id
            : NovoId();
        var nova = new Maquina
        {
            Id = escolhido,
            Sal = Convert.ToHexString(RandomNumberGenerator.GetBytes(8))
        };
        nova.Hash = Hash(nova.Sal, senha);
        _maquinas[nova.Id] = nova;
        Salvar();
        return nova;
    }

    static bool SenhaConfere(Maquina maquina, string senha)
    {
        var hash = Hash(maquina.Sal, senha);
        return CryptographicOperations.FixedTimeEquals(
            Convert.FromHexString(hash),
            Convert.FromHexString(maquina.Hash));
    }

    static string Hash(string sal, string senha)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(sal + "\n" + senha);
        return Convert.ToHexString(SHA256.HashData(bytes));
    }

    string NovoId()
    {
        for (var i = 0; i < 20; i++)
        {
            var n = RandomNumberGenerator.GetInt32(100_000_000, 1_000_000_000);
            var id = n.ToString();
            if (!_maquinas.ContainsKey(id)) return id;
        }
        return RandomNumberGenerator.GetInt32(100_000_000, 1_000_000_000).ToString();
    }

    void Carregar()
    {
        if (!File.Exists(_arquivoCadastro)) return;
        try
        {
            var lista = JsonSerializer.Deserialize<List<Maquina>>(File.ReadAllText(_arquivoCadastro)) ?? new();
            foreach (var item in lista)
            {
                if (item.Id.Length == 0) continue;
                _maquinas[item.Id] = item;
            }
        }
        catch { }
    }

    void Salvar()
    {
        lock (_arquivo)
        {
            var lista = _maquinas.Values.Select(m => new Maquina { Id = m.Id, Sal = m.Sal, Hash = m.Hash }).ToList();
            File.WriteAllText(_arquivoCadastro, JsonSerializer.Serialize(lista));
        }
    }
}
