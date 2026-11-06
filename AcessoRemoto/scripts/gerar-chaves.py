#!/usr/bin/env python3
"""Gera o par de chaves do hbbs no formato do RustDesk. Nao substitui uma chave existente."""
import base64
import sys
from pathlib import Path

from nacl.signing import SigningKey

raiz = Path(__file__).resolve().parents[1]
data = raiz / "data"
data.mkdir(exist_ok=True)
privada = data / "id_ed25519"
publica = data / "id_ed25519.pub"

if privada.exists() or publica.exists():
    sys.exit("A pasta data ja tem chave. Ela nao sera substituida.")

publico = "/"
segredo = b""
while "/" in publico or ":" in publico:
    chave = SigningKey.generate()
    semente = bytes(chave)
    bruto = bytes(chave.verify_key)
    segredo = semente + bruto
    publico = base64.b64encode(bruto).decode("ascii")

privada.write_text(base64.b64encode(segredo).decode("ascii") + "\n", encoding="ascii")
publica.write_text(publico + "\n", encoding="ascii")
privada.chmod(0o600)
print(publico)
