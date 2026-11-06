namespace AcessoRemoto;

sealed class ServidorForm : Form
{
    readonly TextBox _log = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill, Font = new Font(FontFamily.GenericMonospace, 10f) };
    readonly CancellationTokenSource _ct = new();
    ServidorNucleo? _nucleo;

    public ServidorForm()
    {
        Text = "Acesso remoto — servidor";
        Width = 720;
        Height = 480;
        StartPosition = FormStartPosition.CenterScreen;
        Controls.Add(_log);
        var aviso = new Label
        {
            Dock = DockStyle.Top,
            Height = 48,
            Text = "Deixe esta janela aberta. Ela e o servidor da empresa. O cliente e o tecnico dependem dela."
        };
        Controls.Add(aviso);
        Shown += async (_, _) => await IniciarAsync();
        FormClosing += (_, _) => _ct.Cancel();
    }

    async Task IniciarAsync()
    {
        try
        {
            _nucleo = new ServidorNucleo(Program.PastaExe());
            _nucleo.Log = Linha;
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
