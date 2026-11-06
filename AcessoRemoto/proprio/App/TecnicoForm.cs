using System.Net.Security;
using System.Net.Sockets;
using System.Security.Cryptography;
using AcessoRemoto.Comum;

namespace AcessoRemoto;

sealed class TecnicoForm : Form
{
    readonly TextBox _id = new() { Location = new Point(48, 14), Width = 160 };
    readonly TextBox _senha = new() { Location = new Point(280, 14), Width = 180 };
    readonly Button _conectar = new() { Text = "Conectar", Location = new Point(480, 12), Width = 110 };
    readonly Label _estado = new() { AutoSize = true, Location = new Point(610, 16) };
    readonly PictureBox _tela = new() { Dock = DockStyle.Fill, BackColor = Color.Black, SizeMode = PictureBoxSizeMode.Zoom };
    CancellationTokenSource? _ct;
    Stream? _fluxo;
    readonly SemaphoreSlim _envio = new(1, 1);
    int _imgLargura = 1;
    int _imgAltura = 1;

    public TecnicoForm()
    {
        Text = "Acesso remoto — tecnico";
        Width = 1100;
        Height = 720;
        StartPosition = FormStartPosition.CenterScreen;
        KeyPreview = true;
        var topo = new Panel { Dock = DockStyle.Top, Height = 48 };
        topo.Controls.Add(new Label { Text = "ID", Location = new Point(16, 16), AutoSize = true });
        topo.Controls.Add(_id);
        topo.Controls.Add(new Label { Text = "Senha", Location = new Point(220, 16), AutoSize = true });
        topo.Controls.Add(_senha);
        topo.Controls.Add(_conectar);
        topo.Controls.Add(_estado);
        Controls.Add(_tela);
        Controls.Add(topo);
        _conectar.Click += async (_, _) => await ConectarAsync();
        _tela.MouseMove += (_, e) => EnviarMouse(e, 0, 0, 0);
        _tela.MouseDown += (_, e) => { _tela.Focus(); EnviarMouse(e, Botao(e.Button), 1, 0); };
        _tela.MouseUp += (_, e) => EnviarMouse(e, Botao(e.Button), 2, 0);
        _tela.MouseWheel += (_, e) => EnviarMouse(e, 0, 3, (short)Math.Clamp(e.Delta, short.MinValue, short.MaxValue));
        KeyDown += (_, e) => EnviarTecla(e, true);
        KeyUp += (_, e) => EnviarTecla(e, false);
        FormClosing += (_, _) => _ct?.Cancel();
    }

    async Task ConectarAsync()
    {
        _ct?.Cancel();
        _ct = new CancellationTokenSource();
        var ct = _ct.Token;
        var id = _id.Text.Trim();
        var senha = _senha.Text;
        if (id.Length == 0 || senha.Length == 0)
        {
            _estado.Text = "Digite o ID e a senha.";
            return;
        }
        var conf = ConfLocal.Ler(Path.Combine(Program.PastaExe(), "servidor.conf"));
        conf.TryGetValue("IP", out var ip);
        conf.TryGetValue("PORTA", out var portaTexto);
        conf.TryGetValue("IMPRESSAO", out var impressao);
        if (string.IsNullOrWhiteSpace(ip) || ip == "DEFINIR" || string.IsNullOrWhiteSpace(impressao))
        {
            _estado.Text = "Abra o servidor da empresa antes.";
            return;
        }
        if (!int.TryParse(portaTexto, out var porta)) porta = 47200;
        _conectar.Enabled = false;
        try
        {
            _estado.Text = "Conectando no servidor deste computador...";
            var tcp = new TcpClient();
            using (var estouro = CancellationTokenSource.CreateLinkedTokenSource(ct))
            {
                estouro.CancelAfter(TimeSpan.FromSeconds(4));
                await tcp.ConnectAsync("127.0.0.1", porta, estouro.Token);
            }
            tcp.NoDelay = true;
            var ssl = new SslStream(tcp.GetStream(), false, (_, cert, _, _) =>
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
            _fluxo = ssl;
            await Pacote.EnviarAsync(ssl, Tipos.Entrar, Mensagens.Texto(new Aviso { Id = id, Senha = senha }), ct);
            var resposta = await Pacote.LerAsync(ssl, ct);
            if (resposta == null || resposta.Value.Tipo == Tipos.Erro)
            {
                var msg = resposta == null ? "Sem resposta." : Mensagens.LerTexto(resposta.Value.Dados).Mensagem;
                _estado.Text = string.IsNullOrWhiteSpace(msg) ? "ID ou senha nao confere." : msg;
                ssl.Dispose();
                tcp.Close();
                _fluxo = null;
                return;
            }
            _estado.Text = "Conectado ao " + id;
            _ = Task.Run(() => LerTelaAsync(ssl, ct));
        }
        catch (OperationCanceledException)
        {
            _estado.Text = "O servidor nao respondeu neste computador. Deixe a janela do servidor aberta.";
        }
        catch (Exception ex)
        {
            _estado.Text = ex.Message;
        }
        finally
        {
            _conectar.Enabled = true;
        }
    }

    async Task LerTelaAsync(Stream ssl, CancellationToken ct)
    {
        try
        {
            while (!ct.IsCancellationRequested)
            {
                var pacote = await Pacote.LerAsync(ssl, ct);
                if (pacote == null) break;
                if (pacote.Value.Tipo != Tipos.Frame || pacote.Value.Dados.Length == 0) continue;
                using var ms = new MemoryStream(pacote.Value.Dados);
                using var img = Image.FromStream(ms);
                var copia = new Bitmap(img);
                _imgLargura = copia.Width;
                _imgAltura = copia.Height;
                BeginInvoke(() =>
                {
                    var antiga = _tela.Image;
                    _tela.Image = copia;
                    antiga?.Dispose();
                });
            }
        }
        catch (OperationCanceledException) { }
        catch { }
        try { BeginInvoke(() => _estado.Text = "Ligacao encerrada."); } catch { }
    }

    static byte Botao(MouseButtons botao)
    {
        if (botao == MouseButtons.Right) return 2;
        if (botao == MouseButtons.Middle) return 4;
        return 1;
    }

    void EnviarMouse(MouseEventArgs e, byte botao, byte acao, short roda)
    {
        var fluxo = _fluxo;
        if (fluxo == null || _imgLargura < 2 || _imgAltura < 2) return;
        var escala = Math.Min((float)_tela.Width / _imgLargura, (float)_tela.Height / _imgAltura);
        var dw = _imgLargura * escala;
        var dh = _imgAltura * escala;
        var ox = (_tela.Width - dw) / 2f;
        var oy = (_tela.Height - dh) / 2f;
        var ix = (e.X - ox) / dw;
        var iy = (e.Y - oy) / dh;
        if (ix < 0 || iy < 0 || ix > 1 || iy > 1) return;
        var x = (ushort)Math.Clamp((int)Math.Round(ix * 65535), 0, 65535);
        var y = (ushort)Math.Clamp((int)Math.Round(iy * 65535), 0, 65535);
        var dados = Mensagens.Mouse(x, y, botao, acao, roda);
        _ = EnviarAsync(Tipos.Mouse, dados);
    }

    void EnviarTecla(KeyEventArgs e, bool pressionada)
    {
        if (_fluxo == null || ActiveControl is TextBox) return;
        var dados = Mensagens.Tecla((ushort)e.KeyCode, pressionada);
        _ = EnviarAsync(Tipos.Tecla, dados);
    }

    async Task EnviarAsync(byte tipo, byte[] dados)
    {
        var fluxo = _fluxo;
        if (fluxo == null) return;
        try
        {
            await _envio.WaitAsync();
            try { await Pacote.EnviarAsync(fluxo, tipo, dados, CancellationToken.None); }
            finally { _envio.Release(); }
        }
        catch { }
    }
}
