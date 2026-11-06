namespace AcessoRemoto;

sealed class ServidorForm : Form
{
    readonly TextBox _log = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill, Font = new Font(FontFamily.GenericMonospace, 10f) };
    readonly TextBox _ip = new() { Location = new Point(16, 36), Width = 180 };
    readonly CancellationTokenSource _ct = new();
    ServidorNucleo? _nucleo;

    public ServidorForm()
    {
        Text = "Acesso remoto — servidor da empresa";
        Width = 760;
        Height = 520;
        StartPosition = FormStartPosition.CenterScreen;
        var painel = new Panel { Dock = DockStyle.Top, Height = 78 };
        painel.Controls.Add(new Label
        {
            AutoSize = true,
            Location = new Point(16, 10),
            Text = "IP da internet da empresa. O cliente esta em outro lugar e usa este numero."
        });
        painel.Controls.Add(_ip);
        var gravar = new Button { Text = "Gravar na pasta do cliente", Location = new Point(208, 34), Width = 200 };
        gravar.Click += (_, _) => _nucleo?.GravarIpCliente(_ip.Text);
        painel.Controls.Add(gravar);
        Controls.Add(_log);
        Controls.Add(painel);
        Shown += async (_, _) => await IniciarAsync();
        FormClosing += (_, _) => _ct.Cancel();
    }

    async Task IniciarAsync()
    {
        try
        {
            _nucleo = new ServidorNucleo(Program.PastaExe());
            _nucleo.Log = Linha;
            _nucleo.IpSugerido = ip => BeginInvoke(() => _ip.Text = ip);
            await _nucleo.RodarAsync(_ct.Token);
        }
        catch (Exception ex)
        {
            Linha("Nao foi possivel abrir a porta 47200. " + ex.Message);
            Linha("Feche a outra janela do servidor, se ela ja estiver aberta.");
        }
    }

    void Linha(string texto)
    {
        if (IsDisposed) return;
        BeginInvoke(() =>
        {
            _log.AppendText(DateTime.Now.ToString("HH:mm:ss") + "  " + texto + Environment.NewLine);
        });
    }
}
