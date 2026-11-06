using System.Text.Json;

namespace AcessoRemoto.Comum;

public sealed class Aviso
{
    public string Id { get; set; } = "";
    public string Senha { get; set; } = "";
    public string Mensagem { get; set; } = "";
}

public static class Mensagens
{
    static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    public static byte[] Texto(Aviso aviso) => JsonSerializer.SerializeToUtf8Bytes(aviso, Json);

    public static Aviso LerTexto(byte[] dados) =>
        JsonSerializer.Deserialize<Aviso>(dados, Json) ?? new Aviso();

    public static byte[] Mouse(ushort x, ushort y, byte botao, byte acao, short roda)
    {
        var b = new byte[8];
        b[0] = (byte)(x >> 8);
        b[1] = (byte)x;
        b[2] = (byte)(y >> 8);
        b[3] = (byte)y;
        b[4] = botao;
        b[5] = acao;
        b[6] = (byte)(roda >> 8);
        b[7] = (byte)roda;
        return b;
    }

    public static bool LerMouse(byte[] dados, out ushort x, out ushort y, out byte botao, out byte acao, out short roda)
    {
        x = y = 0;
        botao = acao = 0;
        roda = 0;
        if (dados.Length < 8) return false;
        x = (ushort)((dados[0] << 8) | dados[1]);
        y = (ushort)((dados[2] << 8) | dados[3]);
        botao = dados[4];
        acao = dados[5];
        roda = (short)((dados[6] << 8) | dados[7]);
        return true;
    }

    public static byte[] Tecla(ushort vk, bool pressionada)
    {
        return new[] { (byte)(vk >> 8), (byte)vk, pressionada ? (byte)1 : (byte)0 };
    }

    public static bool LerTecla(byte[] dados, out ushort vk, out bool pressionada)
    {
        vk = 0;
        pressionada = false;
        if (dados.Length < 3) return false;
        vk = (ushort)((dados[0] << 8) | dados[1]);
        pressionada = dados[2] == 1;
        return true;
    }
}
