namespace AcessoRemoto;

static class Program
{
    static Mutex? _mutex;

    [STAThread]
    static void Main()
    {
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        var modo = LerModo();
        if (!ReservarInstancia(modo)) return;
        Form janela = modo switch
        {
            "servidor" => new ServidorForm(),
            "tecnico" => new TecnicoForm(),
            _ => new ClienteForm()
        };
        Application.Run(janela);
    }

    static bool ReservarInstancia(string modo)
    {
        var nome = modo == "servidor" ? @"Local\AcessoRemotoServidor" : modo == "tecnico" ? @"Local\AcessoRemotoTecnico" : @"Local\AcessoRemotoCliente";
        _mutex = new Mutex(true, nome, out var novo);
        if (novo) return true;
        if (modo == "servidor")
            MessageBox.Show("O servidor ja esta aberto. Deixe aquela janela aberta.");
        return false;
    }

    public static string PastaExe()
    {
        var caminho = Environment.ProcessPath;
        if (string.IsNullOrEmpty(caminho)) caminho = Application.ExecutablePath;
        return Path.GetDirectoryName(caminho) ?? AppContext.BaseDirectory;
    }

    static string LerModo()
    {
        var arquivo = Path.Combine(PastaExe(), "modo.txt");
        if (!File.Exists(arquivo)) return "cliente";
        var texto = File.ReadAllText(arquivo).Trim().ToLowerInvariant();
        if (texto is "servidor" or "tecnico" or "cliente") return texto;
        return "cliente";
    }
}
