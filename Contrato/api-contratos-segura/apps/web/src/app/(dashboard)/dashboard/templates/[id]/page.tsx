"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  ArrowLeft, Plus, Trash2, Pencil, Check, X,
  ChevronUp, ChevronDown, Save, GripVertical,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Template = { id: string; name: string; content: string; isDefault: boolean };

type Clause = {
  id: string;
  number: string;    // "Cláusula 1ª:"
  content: string;   // texto da cláusula
};

type Section = {
  id: string;
  title: string;     // "DO OBJETO DO CONTRATO"
  clauses: Clause[];
};

type ContractStructure = {
  header: string;    // tudo antes da primeira seção
  sections: Section[];
  footer: string;    // marcador de assinatura + dados
};

// ─── Funções de parse / rebuild ───────────────────────────────────────────────

let _uid = 0;
function uid() { return `id_${++_uid}_${Math.random().toString(36).slice(2)}`; }

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t || t.length < 3) return false;
  if (/^Cláusula\s+\d/.test(t)) return false;
  if (t.includes("R$")) return false;
  if (t.startsWith("Contrato de")) return false;
  return /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s,\/–-]+$/.test(t);
}

function parseTemplate(content: string): ContractStructure {
  const MARKER = "---ASSINATURA---";
  const markerIdx = content.indexOf(MARKER);
  const footer = markerIdx >= 0 ? content.slice(markerIdx) : "";
  const body   = markerIdx >= 0 ? content.slice(0, markerIdx) : content;

  const lines = body.split("\n");
  const sections: Section[] = [];
  let header = "";
  let inHeader = true;
  let currentSection: Section | null = null;
  let currentClause: Clause | null = null;

  const flushClause = () => {
    if (currentClause && currentSection) {
      currentClause.content = currentClause.content.trimEnd();
      currentSection.clauses.push(currentClause);
      currentClause = null;
    }
  };
  const flushSection = () => {
    flushClause();
    if (currentSection) sections.push(currentSection);
    currentSection = null;
  };

  for (const raw of lines) {
    const line = raw;
    const trimmed = line.trim();

    if (isSectionHeader(trimmed)) {
      flushSection();
      inHeader = false;
      currentSection = { id: uid(), title: trimmed, clauses: [] };
      continue;
    }

    if (/^Cláusula\s+\d/.test(trimmed) && currentSection) {
      flushClause();
      currentClause = { id: uid(), number: trimmed, content: "" };
      continue;
    }

    if (inHeader) {
      header += raw + "\n";
    } else if (currentClause) {
      currentClause.content += raw + "\n";
    }
    // lines between section header and first clause are ignored (blank lines)
  }
  flushSection();

  return { header: header.trimEnd(), sections, footer: footer.trimEnd() };
}

function rebuildTemplate(s: ContractStructure): string {
  const parts: string[] = [s.header, ""];

  for (const sec of s.sections) {
    parts.push(sec.title);
    for (const cl of sec.clauses) {
      parts.push(cl.number);
      parts.push(cl.content.trimEnd());
      parts.push("");
    }
  }

  parts.push(s.footer);
  return parts.join("\n");
}

// ─── Componente: card de uma cláusula ────────────────────────────────────────

function ClauseCard({
  clause, index, total,
  onEdit, onDelete, onMove,
}: {
  clause: Clause; index: number; total: number;
  onEdit: (id: string, number: string, content: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftNum, setDraftNum] = useState(clause.number);
  const [draftContent, setDraftContent] = useState(clause.content);

  function save() {
    onEdit(clause.id, draftNum.trim(), draftContent);
    setEditing(false);
  }
  function cancel() {
    setDraftNum(clause.number);
    setDraftContent(clause.content);
    setEditing(false);
  }

  return (
    <div style={{
      border: "1px solid #E8EEF3", borderRadius: 10, background: "#fff",
      overflow: "hidden", transition: "box-shadow 0.15s",
    }}>
      {/* Header da cláusula */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.625rem",
        padding: "0.625rem 0.875rem",
        background: editing ? "rgba(27,122,140,0.06)" : "#FAFCFD",
        borderBottom: "1px solid #E8EEF3",
      }}>
        <GripVertical size={14} style={{ color: "#C0CDD6", flexShrink: 0 }} />

        {editing ? (
          <input
            value={draftNum}
            onChange={(e) => setDraftNum(e.target.value)}
            style={{
              flex: 1, border: "1px solid #D8E3EA", borderRadius: 6,
              padding: "0.25rem 0.5rem", fontSize: "0.8125rem",
              fontWeight: 700, color: "#0D2235", outline: "none",
              background: "#fff",
            }}
          />
        ) : (
          <span style={{ flex: 1, fontWeight: 700, fontSize: "0.875rem", color: "#0D2235" }}>
            {clause.number || <em style={{ color: "#aaa", fontWeight: 400 }}>Sem título</em>}
          </span>
        )}

        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
          {!editing && (
            <>
              <button onClick={() => onMove(clause.id, -1)} disabled={index === 0}
                style={btnIcon}><ChevronUp size={13} /></button>
              <button onClick={() => onMove(clause.id, 1)} disabled={index === total - 1}
                style={btnIcon}><ChevronDown size={13} /></button>
              <button onClick={() => setEditing(true)} style={btnIcon}>
                <Pencil size={13} />
              </button>
              <button onClick={() => onDelete(clause.id)}
                style={{ ...btnIcon, color: "#C0392B" }}><Trash2 size={13} /></button>
            </>
          )}
          {editing && (
            <>
              <button onClick={save} style={{ ...btnIcon, color: "#0F7A6B", background: "#E6F5F3" }}>
                <Check size={13} />
              </button>
              <button onClick={cancel} style={btnIcon}><X size={13} /></button>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ padding: "0.75rem 0.875rem" }}>
        {editing ? (
          <textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            style={{
              width: "100%", minHeight: 110, padding: "0.5rem 0.625rem",
              fontSize: "0.8125rem", border: "1px solid #D8E3EA", borderRadius: 8,
              background: "#fff", color: "#2d2d2d", outline: "none",
              resize: "vertical", fontFamily: "inherit", lineHeight: 1.7,
              boxSizing: "border-box",
            }}
          />
        ) : (
          <p style={{
            fontSize: "0.8125rem", color: "#444", lineHeight: 1.7,
            margin: 0, whiteSpace: "pre-wrap",
          }}>
            {clause.content || <em style={{ color: "#aaa" }}>Sem conteúdo</em>}
          </p>
        )}
      </div>
    </div>
  );
}

const btnIcon: React.CSSProperties = {
  width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: 6, border: "1px solid #E0EAF0", background: "#fff",
  cursor: "pointer", color: "#6B7E8C", transition: "all 0.12s",
};

// ─── Componente: seção ────────────────────────────────────────────────────────

function SectionBlock({
  section, sectionIndex, totalSections, active, onSelect,
  onEditTitle, onDeleteSection, onMoveSection,
  onAddClause, onEditClause, onDeleteClause, onMoveClause,
}: {
  section: Section; sectionIndex: number; totalSections: number;
  active: boolean; onSelect: () => void;
  onEditTitle: (id: string, title: string) => void;
  onDeleteSection: (id: string) => void;
  onMoveSection: (id: string, dir: -1 | 1) => void;
  onAddClause: (sectionId: string) => void;
  onEditClause: (secId: string, clId: string, num: string, content: string) => void;
  onDeleteClause: (secId: string, clId: string) => void;
  onMoveClause: (secId: string, clId: string, dir: -1 | 1) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(section.title);

  function saveTitle() {
    onEditTitle(section.id, draftTitle.trim().toUpperCase());
    setEditingTitle(false);
  }

  return (
    <div style={{
      border: active ? "2px solid #1B7A8C" : "1px solid #E8EEF3",
      borderRadius: 12, overflow: "hidden", marginBottom: "1rem",
      boxShadow: active ? "0 2px 12px rgba(27,122,140,0.12)" : "0 1px 3px rgba(13,34,53,0.04)",
      transition: "all 0.18s",
    }}>
      {/* Cabeçalho da seção */}
      <div
        onClick={() => !editingTitle && onSelect()}
        style={{
          display: "flex", alignItems: "center", gap: "0.625rem",
          padding: "0.75rem 1rem", cursor: editingTitle ? "default" : "pointer",
          background: active ? "linear-gradient(90deg,#0D2235,#1A3548)" : "#F7FAFB",
          borderBottom: active ? "1px solid rgba(255,255,255,0.1)" : "1px solid #E8EEF3",
        }}
      >
        {editingTitle ? (
          <>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setDraftTitle(section.title); setEditingTitle(false); } }}
              autoFocus
              style={{
                flex: 1, border: "1px solid #1B7A8C", borderRadius: 6,
                padding: "0.25rem 0.625rem", fontSize: "0.8125rem", fontWeight: 700,
                background: "#fff", outline: "none", color: "#0D2235",
              }}
            />
            <button onClick={saveTitle} style={{ ...btnIcon, background: "#0D2235", borderColor: "#0D2235", color: "#fff" }}>
              <Check size={12} />
            </button>
            <button onClick={() => { setDraftTitle(section.title); setEditingTitle(false); }} style={{ ...btnIcon, background: "transparent", borderColor: "rgba(255,255,255,0.2)", color: "#fff" }}>
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <span style={{
              flex: 1, fontWeight: 700, fontSize: "0.75rem",
              letterSpacing: "0.07em", textTransform: "uppercase",
              color: active ? "#fff" : "#0D2235",
            }}>
              {section.title}
            </span>
            <span style={{
              fontSize: "0.625rem", fontWeight: 600, padding: "2px 8px",
              borderRadius: 99, background: active ? "rgba(255,255,255,0.15)" : "#E8EEF3",
              color: active ? "rgba(255,255,255,0.8)" : "#6B7E8C",
            }}>
              {section.clauses.length} cláusula{section.clauses.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
              style={{ ...btnIcon, background: active ? "rgba(255,255,255,0.1)" : "#fff", borderColor: active ? "rgba(255,255,255,0.15)" : "#E0EAF0", color: active ? "#fff" : "#6B7E8C" }}
            ><Pencil size={11} /></button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveSection(section.id, -1); }}
              disabled={sectionIndex === 0}
              style={{ ...btnIcon, background: active ? "rgba(255,255,255,0.1)" : "#fff", borderColor: active ? "rgba(255,255,255,0.15)" : "#E0EAF0", color: active ? "#fff" : "#6B7E8C" }}
            ><ChevronUp size={11} /></button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveSection(section.id, 1); }}
              disabled={sectionIndex === totalSections - 1}
              style={{ ...btnIcon, background: active ? "rgba(255,255,255,0.1)" : "#fff", borderColor: active ? "rgba(255,255,255,0.15)" : "#E0EAF0", color: active ? "#fff" : "#6B7E8C" }}
            ><ChevronDown size={11} /></button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteSection(section.id); }}
              style={{ ...btnIcon, background: active ? "rgba(255,255,255,0.05)" : "#fff", borderColor: active ? "rgba(255,255,255,0.15)" : "#E0EAF0", color: "#C0392B" }}
            ><Trash2 size={11} /></button>
          </>
        )}
      </div>

      {/* Cláusulas (só aparecem se ativa) */}
      {active && (
        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {section.clauses.length === 0 && (
            <p style={{ fontSize: "0.8125rem", color: "#8B9EB0", textAlign: "center", padding: "1rem 0" }}>
              Nenhuma cláusula nesta seção. Adicione abaixo.
            </p>
          )}
          {section.clauses.map((cl, ci) => (
            <ClauseCard
              key={cl.id}
              clause={cl}
              index={ci}
              total={section.clauses.length}
              onEdit={(clId, num, content) => onEditClause(section.id, clId, num, content)}
              onDelete={(clId) => onDeleteClause(section.id, clId)}
              onMove={(clId, dir) => onMoveClause(section.id, clId, dir)}
            />
          ))}

          <button
            onClick={() => onAddClause(section.id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
              padding: "0.5rem", borderRadius: 8, border: "2px dashed #C8D8E2",
              background: "transparent", color: "#1B7A8C", fontSize: "0.8125rem",
              fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1B7A8C"; (e.currentTarget as HTMLElement).style.background = "rgba(27,122,140,0.04)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#C8D8E2"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Plus size={14} /> Adicionar cláusula
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ClauseEditorPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [template, setTemplate]       = useState<Template | null>(null);
  const [structure, setStructure]     = useState<ContractStructure | null>(null);
  const [activeSection, setActive]    = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [dirty, setDirty]             = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await apiFetch<Template>(`/templates/${id}`);
      setTemplate(t);
      const s = parseTemplate(t.content);
      setStructure(s);
      if (s.sections.length > 0) setActive(s.sections[0].id);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  function mutate(fn: (s: ContractStructure) => ContractStructure) {
    setStructure((prev) => prev ? fn(prev) : prev);
    setDirty(true);
    setSaved(false);
  }

  // ── Seção ──
  function addSection() {
    const newSec: Section = { id: uid(), title: "NOVA SEÇÃO", clauses: [] };
    mutate((s) => ({ ...s, sections: [...s.sections, newSec] }));
    setActive(newSec.id);
  }
  function editSectionTitle(secId: string, title: string) {
    mutate((s) => ({ ...s, sections: s.sections.map(sec => sec.id === secId ? { ...sec, title } : sec) }));
  }
  function deleteSection(secId: string) {
    if (!confirm("Excluir esta seção e todas as suas cláusulas?")) return;
    mutate((s) => {
      const filtered = s.sections.filter(sec => sec.id !== secId);
      return { ...s, sections: filtered };
    });
    setActive((prev) => {
      if (prev !== secId) return prev;
      return structure?.sections.find(s => s.id !== secId)?.id ?? null;
    });
  }
  function moveSection(secId: string, dir: -1 | 1) {
    mutate((s) => {
      const idx = s.sections.findIndex(sec => sec.id === secId);
      if (idx + dir < 0 || idx + dir >= s.sections.length) return s;
      const arr = [...s.sections];
      [arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]];
      return { ...s, sections: arr };
    });
  }

  // ── Cláusula ──
  function addClause(secId: string) {
    const sec = structure?.sections.find(s => s.id === secId);
    const nextNum = (sec?.clauses.length ?? 0) + 1;
    const newCl: Clause = { id: uid(), number: `Cláusula ${nextNum}ª:`, content: "" };
    mutate((s) => ({
      ...s,
      sections: s.sections.map(sec =>
        sec.id === secId ? { ...sec, clauses: [...sec.clauses, newCl] } : sec
      ),
    }));
  }
  function editClause(secId: string, clId: string, number: string, content: string) {
    mutate((s) => ({
      ...s,
      sections: s.sections.map(sec =>
        sec.id === secId
          ? { ...sec, clauses: sec.clauses.map(cl => cl.id === clId ? { ...cl, number, content } : cl) }
          : sec
      ),
    }));
  }
  function deleteClause(secId: string, clId: string) {
    mutate((s) => ({
      ...s,
      sections: s.sections.map(sec =>
        sec.id === secId ? { ...sec, clauses: sec.clauses.filter(cl => cl.id !== clId) } : sec
      ),
    }));
  }
  function moveClause(secId: string, clId: string, dir: -1 | 1) {
    mutate((s) => ({
      ...s,
      sections: s.sections.map(sec => {
        if (sec.id !== secId) return sec;
        const idx = sec.clauses.findIndex(cl => cl.id === clId);
        if (idx + dir < 0 || idx + dir >= sec.clauses.length) return sec;
        const arr = [...sec.clauses];
        [arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]];
        return { ...sec, clauses: arr };
      }),
    }));
  }

  // ── Salvar ──
  async function handleSave() {
    if (!structure || !template) return;
    setSaving(true);
    try {
      const content = rebuildTemplate(structure);
      await apiFetch(`/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      });
      setSaved(true);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
      <p style={{ color: "var(--gray)" }}>Carregando template...</p>
    </div>
  );

  const totalClauses = structure?.sections.reduce((sum, s) => sum + s.clauses.length, 0) ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
          <button className="btn-ghost" onClick={() => router.push("/dashboard/templates")} style={{ padding: "0.4rem 0.75rem" }}>
            <ArrowLeft size={15} /> Templates
          </button>
          <div>
            <h1 className="page-title">{template?.name}</h1>
            <p className="page-subtitle">
              {structure?.sections.length} seções · {totalClauses} cláusulas
              {dirty && <span style={{ color: "#B07A00", marginLeft: "0.5rem" }}>● Alterações não salvas</span>}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-ghost" onClick={addSection}>
            <Plus size={15} /> Nova seção
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || !dirty}
            style={{ opacity: !dirty ? 0.5 : 1 }}
          >
            {saving ? "Salvando..." : saved ? "✓ Salvo" : <><Save size={14} /> Salvar alterações</>}
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      {(!structure || structure.sections.length === 0) ? (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <p style={{ color: "var(--gray)", marginBottom: "1rem" }}>Nenhuma seção encontrada no template.</p>
          <button className="btn-primary" onClick={addSection}><Plus size={14} /> Criar primeira seção</button>
        </div>
      ) : (
        <div>
          {structure.sections.map((sec, si) => (
            <SectionBlock
              key={sec.id}
              section={sec}
              sectionIndex={si}
              totalSections={structure.sections.length}
              active={activeSection === sec.id}
              onSelect={() => setActive(activeSection === sec.id ? null : sec.id)}
              onEditTitle={editSectionTitle}
              onDeleteSection={deleteSection}
              onMoveSection={moveSection}
              onAddClause={addClause}
              onEditClause={editClause}
              onDeleteClause={deleteClause}
              onMoveClause={moveClause}
            />
          ))}
        </div>
      )}
    </div>
  );
}
