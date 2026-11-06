namespace AcessoRemoto.Comum;

public static class Tipos
{
    public const byte Registrar = 1;
    public const byte Registrado = 2;
    public const byte Entrar = 3;
    public const byte Ok = 4;
    public const byte Erro = 5;
    public const byte Frame = 6;
    public const byte Mouse = 7;
    public const byte Tecla = 8;
    public const byte TecnicoEntrou = 9;
    public const byte TecnicoSaiu = 10;
}

public static class Pacote
{
    public const int TamanhoMaximo = 8_000_000;

    public static async Task EnviarAsync(Stream saida, byte tipo, ReadOnlyMemory<byte> dados, CancellationToken ct)
    {
        var tam = dados.Length;
        if (tam > TamanhoMaximo) throw new IOException("Pacote grande demais.");
        var cabeca = new byte[5];
        cabeca[0] = (byte)(tam >> 24);
        cabeca[1] = (byte)(tam >> 16);
        cabeca[2] = (byte)(tam >> 8);
        cabeca[3] = (byte)tam;
        cabeca[4] = tipo;
        await saida.WriteAsync(cabeca, ct);
        if (tam > 0) await saida.WriteAsync(dados, ct);
        await saida.FlushAsync(ct);
    }

    public static async Task<(byte Tipo, byte[] Dados)?> LerAsync(Stream entrada, CancellationToken ct)
    {
        var cabeca = await LerExatoAsync(entrada, 5, ct);
        if (cabeca == null) return null;
        var tam = (cabeca[0] << 24) | (cabeca[1] << 16) | (cabeca[2] << 8) | cabeca[3];
        if (tam < 0 || tam > TamanhoMaximo) throw new IOException("Pacote invalido.");
        var dados = tam == 0 ? Array.Empty<byte>() : await LerExatoAsync(entrada, tam, ct);
        if (dados == null) return null;
        return (cabeca[4], dados);
    }

    static async Task<byte[]?> LerExatoAsync(Stream entrada, int quantidade, CancellationToken ct)
    {
        var buf = new byte[quantidade];
        var lido = 0;
        while (lido < quantidade)
        {
            var n = await entrada.ReadAsync(buf.AsMemory(lido, quantidade - lido), ct);
            if (n == 0) return null;
            lido += n;
        }
        return buf;
    }
}
