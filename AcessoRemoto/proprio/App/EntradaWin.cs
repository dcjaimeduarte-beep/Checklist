using System.Runtime.InteropServices;

namespace AcessoRemoto;

static class EntradaWin
{
    public static void Mouse(ushort xNorm, ushort yNorm, byte botao, byte acao, short roda)
    {
        var area = Screen.PrimaryScreen?.Bounds ?? new Rectangle(0, 0, 1, 1);
        var x = area.Left + (int)Math.Round(xNorm / 65535.0 * Math.Max(1, area.Width - 1));
        var y = area.Top + (int)Math.Round(yNorm / 65535.0 * Math.Max(1, area.Height - 1));
        Cursor.Position = new Point(x, y);
        if (acao == 3)
        {
            mouse_event(0x0800, 0, 0, roda, UIntPtr.Zero);
            return;
        }
        uint flag = 0;
        if (botao == 1) flag = acao == 1 ? 0x0002u : acao == 2 ? 0x0004u : 0;
        else if (botao == 2) flag = acao == 1 ? 0x0008u : acao == 2 ? 0x0010u : 0;
        else if (botao == 4) flag = acao == 1 ? 0x0020u : acao == 2 ? 0x0040u : 0;
        if (flag != 0) mouse_event(flag, 0, 0, 0, UIntPtr.Zero);
    }

    public static void Tecla(ushort vk, bool pressionada)
    {
        var entrada = new INPUT
        {
            type = 1,
            U = new InputUnion
            {
                ki = new KEYBDINPUT
                {
                    wVk = vk,
                    dwFlags = pressionada ? 0u : 2u,
                    dwExtraInfo = IntPtr.Zero
                }
            }
        };
        SendInput(1, new[] { entrada }, Marshal.SizeOf<INPUT>());
    }

    [DllImport("user32.dll")]
    static extern void mouse_event(uint dwFlags, uint dx, uint dy, int dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT
    {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public int mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }
}
