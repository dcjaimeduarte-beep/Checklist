using AcessoRemoto.Comum;

var ms = new MemoryStream();
await Pacote.EnviarAsync(ms, Tipos.Frame, new byte[] { 1, 2, 3, 4 }, CancellationToken.None);
await Pacote.EnviarAsync(ms, Tipos.Ok, ReadOnlyMemory<byte>.Empty, CancellationToken.None);
ms.Position = 0;
var frame = await Pacote.LerAsync(ms, CancellationToken.None);
var ok = await Pacote.LerAsync(ms, CancellationToken.None);
if (frame == null || frame.Value.Tipo != Tipos.Frame || frame.Value.Dados.Length != 4 || frame.Value.Dados[3] != 4)
{
    Console.Error.WriteLine("frame nao voltou inteiro");
    return 1;
}
if (ok == null || ok.Value.Tipo != Tipos.Ok || ok.Value.Dados.Length != 0)
{
    Console.Error.WriteLine("ok nao voltou");
    return 1;
}
if (await Pacote.LerAsync(ms, CancellationToken.None) != null)
{
    Console.Error.WriteLine("sobrou dado");
    return 1;
}
Console.WriteLine("codec ok");
return 0;
