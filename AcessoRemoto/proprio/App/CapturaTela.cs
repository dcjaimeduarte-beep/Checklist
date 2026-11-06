using System.Drawing.Imaging;

namespace AcessoRemoto;

static class CapturaTela
{
    public static byte[]? Jpeg()
    {
        var tela = Screen.PrimaryScreen;
        if (tela == null) return null;
        var area = tela.Bounds;
        using var original = new Bitmap(area.Width, area.Height);
        using (var g = Graphics.FromImage(original))
        {
            g.CopyFromScreen(area.Location, Point.Empty, area.Size);
        }
        var largura = area.Width;
        var altura = area.Height;
        if (largura > 1280)
        {
            altura = Math.Max(1, (int)Math.Round(altura * (1280.0 / largura)));
            largura = 1280;
        }
        using var reduzida = new Bitmap(largura, altura);
        using (var g = Graphics.FromImage(reduzida))
        {
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.Bilinear;
            g.DrawImage(original, 0, 0, largura, altura);
        }
        using var ms = new MemoryStream();
        var codec = ImageCodecInfo.GetImageEncoders().First(c => c.MimeType == "image/jpeg");
        using var parametros = new EncoderParameters(1);
        parametros.Param[0] = new EncoderParameter(Encoder.Quality, 40L);
        reduzida.Save(ms, codec, parametros);
        return ms.ToArray();
    }
}
