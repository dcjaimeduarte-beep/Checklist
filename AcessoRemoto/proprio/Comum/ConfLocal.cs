namespace AcessoRemoto.Comum;

public static class ConfLocal
{
    public static Dictionary<string, string> Ler(string caminho)
    {
        var mapa = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (!File.Exists(caminho)) return mapa;
        foreach (var bruta in File.ReadAllLines(caminho))
        {
            var linha = bruta.Trim();
            if (linha.Length == 0 || linha.StartsWith('#')) continue;
            var i = linha.IndexOf('=');
            if (i < 1) continue;
            mapa[linha[..i].Trim()] = linha[(i + 1)..].Trim();
        }
        return mapa;
    }

    public static void Gravar(string caminho, IEnumerable<string> linhas)
    {
        var pasta = Path.GetDirectoryName(caminho);
        if (!string.IsNullOrEmpty(pasta)) Directory.CreateDirectory(pasta);
        File.WriteAllLines(caminho, linhas);
    }
}
