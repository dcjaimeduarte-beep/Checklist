using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;

namespace AcessoRemoto;

static class PortaInternet
{
    public static bool IpPublicoUtil(string? ip)
    {
        if (string.IsNullOrWhiteSpace(ip) || !IPAddress.TryParse(ip, out var endereco)) return false;
        if (endereco.AddressFamily != AddressFamily.InterNetwork) return false;
        var b = endereco.GetAddressBytes();
        if (b[0] == 10 || b[0] == 127) return false;
        if (b[0] == 192 && b[1] == 168) return false;
        if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return false;
        if (b[0] == 100 && b[1] >= 64 && b[1] <= 127) return false;
        return true;
    }

    public static async Task<(string? Ip, bool PortaAberta, string Detalhe)> AbrirAsync(int porta, string ipInterno, CancellationToken ct)
    {
        string? local = null;
        try
        {
            local = await AcharRoteadorAsync(ct);
        }
        catch (Exception ex)
        {
            return (null, false, "O roteador nao respondeu. " + ex.Message);
        }
        if (local == null) return (null, false, "O roteador nao anunciou a abertura automatica da porta.");
        try
        {
            var (controle, tipo) = await LerControleAsync(local, ct);
            if (controle == null || tipo == null) return (null, false, "O roteador nao tem o servico de encaminhar porta.");
            var externo = await SoapAsync(controle, tipo, "GetExternalIPAddress", "", ct);
            var ip = Extrair(externo, "NewExternalIPAddress");
            var corpo = "<NewRemoteHost></NewRemoteHost>"
                + "<NewExternalPort>" + porta + "</NewExternalPort>"
                + "<NewProtocol>TCP</NewProtocol>"
                + "<NewInternalPort>" + porta + "</NewInternalPort>"
                + "<NewInternalClient>" + ipInterno + "</NewInternalClient>"
                + "<NewEnabled>1</NewEnabled>"
                + "<NewPortMappingDescription>AcessoRemoto</NewPortMappingDescription>"
                + "<NewLeaseDuration>0</NewLeaseDuration>";
            var mapa = await SoapAsync(controle, tipo, "AddPortMapping", corpo, ct);
            var abriu = mapa.Contains("AddPortMappingResponse", StringComparison.OrdinalIgnoreCase)
                && !mapa.Contains("Fault", StringComparison.OrdinalIgnoreCase);
            var detalhe = abriu
                ? "O roteador abriu a porta " + porta + " para este computador."
                : "O roteador respondeu, mas nao abriu a porta. Encaminhe " + porta + "/tcp manualmente para " + ipInterno + ".";
            return (ip, abriu, detalhe);
        }
        catch (Exception ex)
        {
            return (null, false, "Nao consegui abrir a porta no roteador. " + ex.Message);
        }
    }

    public static async Task<string?> DescobrirIpAsync(CancellationToken ct)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
            var texto = (await http.GetStringAsync("https://api.ipify.org", ct)).Trim();
            return IPAddress.TryParse(texto, out _) ? texto : null;
        }
        catch
        {
            return null;
        }
    }

    static async Task<string?> AcharRoteadorAsync(CancellationToken ct)
    {
        using var udp = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, ProtocolType.Udp);
        udp.Bind(new IPEndPoint(IPAddress.Any, 0));
        var pedido = Encoding.ASCII.GetBytes(
            "M-SEARCH * HTTP/1.1\r\n" +
            "HOST: 239.255.255.250:1900\r\n" +
            "MAN: \"ssdp:discover\"\r\n" +
            "MX: 2\r\n" +
            "ST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n\r\n");
        await udp.SendToAsync(pedido, new IPEndPoint(IPAddress.Parse("239.255.255.250"), 1900), ct);
        var fim = DateTime.UtcNow.AddSeconds(3);
        while (DateTime.UtcNow < fim && !ct.IsCancellationRequested)
        {
            using var espera = CancellationTokenSource.CreateLinkedTokenSource(ct);
            var restante = fim - DateTime.UtcNow;
            if (restante <= TimeSpan.Zero) break;
            espera.CancelAfter(restante);
            try
            {
                var buffer = new byte[8192];
                var lido = await udp.ReceiveAsync(buffer, SocketFlags.None, espera.Token);
                var texto = Encoding.ASCII.GetString(buffer, 0, lido);
                var linha = texto.Split('\n').FirstOrDefault(l => l.StartsWith("LOCATION:", StringComparison.OrdinalIgnoreCase));
                if (linha == null) continue;
                var url = linha.Substring(9).Trim();
                if (url.StartsWith("http", StringComparison.OrdinalIgnoreCase)) return url;
            }
            catch (OperationCanceledException) { break; }
            catch { break; }
        }
        return null;
    }

    static async Task<(Uri? Controle, string? Tipo)> LerControleAsync(string local, CancellationToken ct)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
        var xml = await http.GetStringAsync(local, ct);
        foreach (Match bloco in Regex.Matches(xml, @"<(?:\w+:)?service>.*?</(?:\w+:)?service>", RegexOptions.Singleline))
        {
            var tipo = Regex.Match(bloco.Value, @"serviceType>\s*([^<]+)");
            var url = Regex.Match(bloco.Value, @"controlURL>\s*([^<]+)");
            if (!tipo.Success || !url.Success) continue;
            var nome = tipo.Groups[1].Value.Trim();
            if (!nome.Contains("WANIPConnection", StringComparison.Ordinal) && !nome.Contains("WANPPPConnection", StringComparison.Ordinal)) continue;
            var caminho = url.Groups[1].Value.Trim();
            var controle = caminho.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                ? new Uri(caminho)
                : new Uri(new Uri(local), caminho);
            return (controle, nome);
        }
        return (null, null);
    }

    static async Task<string> SoapAsync(Uri controle, string tipo, string acao, string corpo, CancellationToken ct)
    {
        var envelope = "<?xml version=\"1.0\"?>"
            + "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">"
            + "<s:Body><u:" + acao + " xmlns:u=\"" + tipo + "\">" + corpo + "</u:" + acao + "></s:Body></s:Envelope>";
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
        using var msg = new HttpRequestMessage(HttpMethod.Post, controle);
        msg.Headers.TryAddWithoutValidation("SOAPAction", "\"" + tipo + "#" + acao + "\"");
        msg.Content = new StringContent(envelope, Encoding.UTF8, "text/xml");
        using var resp = await http.SendAsync(msg, ct);
        return await resp.Content.ReadAsStringAsync(ct);
    }

    static string? Extrair(string xml, string tag)
    {
        var m = Regex.Match(xml, "<" + tag + ">\\s*([^<]+)\\s*</" + tag + ">");
        return m.Success ? m.Groups[1].Value.Trim() : null;
    }
}
