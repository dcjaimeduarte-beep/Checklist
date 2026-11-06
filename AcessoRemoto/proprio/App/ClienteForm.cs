using System.Net.Security;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using AcessoRemoto.Comum;

namespace AcessoRemoto;

sealed class ClienteForm : Form
{
    readonly Label _id = new() { AutoSize = true, Font = new Font(FontFamily.GenericSansSerif, 22f, FontStyle.Bold), Location = new Point(24, 70) };
    readonly Label _senha = new() { AutoSize = true, Font = new Font(FontFamily.GenericSansSerif, 14f), Location = new Point(24, 120) };
    readonly Label _estado = new() { AutoSize = true, Location = new Point(24, 170) };
    readonly CancellationTokenSource _ct = new();
    volatile bool _tecnicoPresente;
    string _idTexto = "";
    string _senhaTexto = "";

    public ClienteForm()
    {
        Text = "Acesso remoto — este computador";
        Width = 520;
        Height = 280;
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        Controls.Add(new Label
        {
            AutoSize = true,
            Location = new Point(24, 24),
            Text = "Deixe esta janela aberta. O tecnico entra com o ID e a senha."
        });
        Controls.Add(_id);
        Controls.Add(_senha);
        Controls.Add(_estado);
        Shown += (_, _) => _ = Task.Run(() => LoopAsync(_ct.Token));
        FormClosing += (_, _) => _ct.Cancel();
    }

    async Task LoopAsync(CancellationToken ct)
    {
        var confPath = Path.Combine(Program.PastaExe(), "servidor.conf");
        var conf = ConfLocal.Ler(confPath);
        conf.TryGetValue("IP", out var ip);
        conf.TryGetValue("PORTA", out var portaTexto);
        conf.TryGetValue("IMPRESSAO", out var impressao);
        if (string.IsNullOrWhiteSpace(ip) || ip == "DEFINIR" || string.IsNullOrWhiteSpace(impressao))
        {
            Estado("A empresa ainda nao preparou esta pasta. Abra o servidor la e copie a pasta de novo.");
            return;
        }
        if (!int.TryParse(portaTexto, out var porta)) porta = 47200;
        CarregarIdentidade();
        IdNaTela();
        GravarAreaDeTrabalho();
        CriarAtalhoDeInicio();

        while (!ct.IsCancellationRequested)
        {
            try
            {
                Estado("Conectando ao servidor da empresa...");
                using var tcp = new TcpClient();
                await tcp.ConnectAsync(ip, porta, ct);
                tcp.NoDelay = true;
                using var ssl = new SslStream(tcp.GetStream(), false, (_, cert, _, _) =>
                {
                    if (cert == null) return false;
                    var hash = Convert.ToHexString(SHA256.HashData(cert.GetRawCertData()));
                    return hash.Equals(impressao, StringComparison.OrdinalIgnoreCase);
                });
                await ssl.AuthenticateAsClientAsync(new SslClientAuthenticationOptions
                {
                    TargetHost = "AcessoRemoto",
                    EnabledSslProtocols = System.Security.Authentication.SslProtocols.Tls12 | System.Security.Authentication.SslProtocols.Tls13
                }, ct);
                await Pacote.EnviarAsync(ssl, Tipos.Registrar, Mensagens.Texto(new Aviso { Id = _idTexto, Senha = _senhaTexto }), ct);
                var resposta = await Pacote.LerAsync(ssl, ct);
                if (resposta == null || resposta.Value.Tipo == Tipos.Erro)
                {
                    var msg = resposta == null ? "Sem resposta." : Mensagens.LerTexto(resposta.Value.Dados).Mensagem;
                    Estado(string.IsNullOrWhiteSpace(msg) ? "O servidor recusou este computador." : msg);
                    await Task.Delay(4000, ct);
                    continue;
                }
                if (resposta.Value.Tipo == Tipos.Registrado)
                {
                    var aviso = Mensagens.LerTexto(resposta.Value.Dados);
                    if (!string.IsNullOrWhiteSpace(aviso.Id) && aviso.Id != _idTexto)
                    {
                        _idTexto = aviso.Id;
                        SalvarIdentidade();
                        IdNaTela();
                        GravarAreaDeTrabalho();
                    }
                }
                Estado("Conectado. Aguardando o tecnico.");
                using var envio = new SemaphoreSlim(1, 1);
                using var capturaCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                var captura = Task.Run(() => CapturarAsync(ssl, envio, capturaCts.Token));
                while (!ct.IsCancellationRequested)
                {
                    var pacote = await Pacote.LerAsync(ssl, ct);
                    if (pacote == null) break;
                    if (pacote.Value.Tipo == Tipos.TecnicoEntrou)
                    {
                        _tecnicoPresente = true;
                        Estado("O tecnico esta vendo esta tela.");
                    }
                    else if (pacote.Value.Tipo == Tipos.TecnicoSaiu)
                    {
                        _tecnicoPresente = false;
                        Estado("Conectado. Aguardando o tecnico.");
                    }
                    else if (pacote.Value.Tipo == Tipos.Mouse && Mensagens.LerMouse(pacote.Value.Dados, out var x, out var y, out var botao, out var acao, out var roda))
                    {
                        try { EntradaWin.Mouse(x, y, botao, acao, roda); } catch { }
                    }
                    else if (pacote.Value.Tipo == Tipos.Tecla && Mensagens.LerTecla(pacote.Value.Dados, out var vk, out var baixo))
                    {
                        try { EntradaWin.Tecla(vk, baixo); } catch { }
                    }
                }
                capturaCts.Cancel();
                _tecnicoPresente = false;
                try { await captura; } catch { }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                Estado("Sem ligacao com o servidor. Nova tentativa em alguns segundos. " + ex.Message);
            }
            try { await Task.Delay(4000, ct); } catch { break; }
        }
    }

    async Task CapturarAsync(Stream ssl, SemaphoreSlim envio, CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (_tecnicoPresente)
                {
                    var jpeg = CapturaTela.Jpeg();
                    if (jpeg != null)
                    {
                        await envio.WaitAsync(ct);
                        try { await Pacote.EnviarAsync(ssl, Tipos.Frame, jpeg, ct); }
                        finally { envio.Release(); }
                    }
                }
                await Task.Delay(_tecnicoPresente ? 250 : 800, ct);
            }
            catch (OperationCanceledException) { break; }
            catch { break; }
        }
    }

    void CarregarIdentidade()
    {
        var arquivo = CaminhoIdentidade();
        if (File.Exists(arquivo))
        {
            try
            {
                var aviso = JsonSerializer.Deserialize<Aviso>(File.ReadAllText(arquivo));
                if (aviso != null && aviso.Id.Length > 0 && aviso.Senha.Length >= 6)
                {
                    _idTexto = aviso.Id;
                    _senhaTexto = aviso.Senha;
                    return;
                }
            }
            catch { }
        }
        _idTexto = "";
        _senhaTexto = NovaSenha();
        SalvarIdentidade();
    }

    void SalvarIdentidade()
    {
        var arquivo = CaminhoIdentidade();
        Directory.CreateDirectory(Path.GetDirectoryName(arquivo)!);
        File.WriteAllText(arquivo, JsonSerializer.Serialize(new Aviso { Id = _idTexto, Senha = _senhaTexto }));
    }

    static string CaminhoIdentidade()
    {
        var baseDir = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        if (string.IsNullOrEmpty(baseDir)) baseDir = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return Path.Combine(baseDir, "AcessoRemoto", "proprio.json");
    }

    static string NovaSenha()
    {
        const string alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        var bytes = RandomNumberGenerator.GetBytes(12);
        var chars = new char[12];
        for (var i = 0; i < chars.Length; i++) chars[i] = alfabeto[bytes[i] % alfabeto.Length];
        return new string(chars);
    }

    void IdNaTela()
    {
        if (IsDisposed) return;
        BeginInvoke(() =>
        {
            _id.Text = "ID: " + (string.IsNullOrEmpty(_idTexto) ? "aguardando o servidor" : _idTexto);
            _senha.Text = "Senha: " + _senhaTexto;
        });
    }

    void Estado(string texto)
    {
        if (IsDisposed) return;
        try
        {
            BeginInvoke(() => _estado.Text = texto);
        }
        catch { }
    }

    void GravarAreaDeTrabalho()
    {
        var texto = "ID: " + _idTexto + Environment.NewLine + "Senha: " + _senhaTexto + Environment.NewLine + Environment.NewLine + "Envie este arquivo para o tecnico." + Environment.NewLine;
        try
        {
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            if (!string.IsNullOrEmpty(desktop))
                File.WriteAllText(Path.Combine(desktop, "Acesso-remoto-desta-maquina.txt"), texto);
        }
        catch { }
        try
        {
            var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "AcessoRemoto");
            Directory.CreateDirectory(pasta);
            File.WriteAllText(Path.Combine(pasta, "maquina.txt"), texto);
        }
        catch { }
    }

    void CriarAtalhoDeInicio()
    {
        try
        {
            var startup = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
            if (string.IsNullOrEmpty(startup)) return;
            var exe = Environment.ProcessPath ?? Application.ExecutablePath;
            var bat = Path.Combine(startup, "AcessoRemoto.bat");
            File.WriteAllText(bat, "@echo off" + Environment.NewLine + "start \"\" \"" + exe + "\"" + Environment.NewLine);
        }
        catch { }
    }
}
