"use client";

import React from "react";
import Image from "next/image";
import { ShieldAlert, ChevronUp, ChevronDown, Plus, X, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDictionary } from "@/lib/dictionary-context";

interface IssueElement {
    value: string;
    label: string;
}

interface TechTaskIssuesSectionProps {
    expanded: boolean;
    onToggle: () => void;
    showNewIssueForm: boolean;
    setShowNewIssueForm: (show: boolean) => void;
    newIssueType: "mantenimiento" | "limpieza" | "inspeccion";
    setNewIssueType: (type: "mantenimiento" | "limpieza" | "inspeccion") => void;
    newIssueElement: string;
    setNewIssueElement: (element: string) => void;
    newIssueTitle: string;
    setNewIssueTitle: (title: string) => void;
    newIssueDescription: string;
    setNewIssueDescription: (desc: string) => void;
    newIssuePhoto: string;
    setNewIssuePhoto: (photo: string) => void;
    issueElements: IssueElement[];
    onAddIssue: (e: React.FormEvent) => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function TechTaskIssuesSection({
    expanded,
    onToggle,
    showNewIssueForm,
    setShowNewIssueForm,
    newIssueType,
    setNewIssueType,
    newIssueElement,
    setNewIssueElement,
    newIssueTitle,
    setNewIssueTitle,
    newIssueDescription,
    setNewIssueDescription,
    newIssuePhoto,
    setNewIssuePhoto,
    issueElements,
    onAddIssue,
    onFileChange,
}: TechTaskIssuesSectionProps) {
    const { dict } = useDictionary();

    return (
        <div className="border border-[var(--border-soft)] rounded-2xl overflow-hidden">
            <button type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-card)] hover:bg-[var(--bg-primary)]/10 transition-colors border-none cursor-pointer text-left"
            >
                <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                    <span className="text-xs font-bold text-[var(--text-main)]">
                        {dict.tech.issues_title}
                    </span>
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
            </button>
            {expanded && (
                <div className="p-4 bg-[var(--bg-primary)]/5 border-t border-[var(--border-soft)] space-y-4">
                    {/* Action Header */}
                    {!showNewIssueForm ? (
                        <div className="flex justify-between items-center">
                            <span className="max-w-[65%] text-[10px] font-semibold text-[var(--text-muted)]">
                                {dict.task_reports.worker_hint}
                            </span>
                            <Button
                                size="sm"
                                onClick={() => setShowNewIssueForm(true)}
                                className="bg-accent hover:bg-accent-light text-white font-bold text-xs px-3 py-1.5 h-8 rounded-xl flex items-center gap-1 border-none cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {dict.tech.issues_report_btn}
                            </Button>
                        </div>
                    ) : null}

                    {/* New issue form */}
                    {showNewIssueForm && (
                        <form onSubmit={onAddIssue} className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-4 space-y-3.5 shadow-sm">
                            <div className="flex justify-between items-center border-b border-[var(--border-soft)] pb-2 mb-1">
                                <h4 className="text-xs font-black uppercase text-[var(--text-main)]">
                                    {dict.tech.issues_new_title}
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => setShowNewIssueForm(false)}
                                    aria-label={dict.tech.btn_cancel}
                                    className="surface-control-btn p-1 rounded-full cursor-pointer flex items-center justify-center transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Type radio buttons */}
                            <div className="space-y-1">
                                <span className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider block">
                                    {dict.tech.issues_type_label}
                                </span>
                                <div className="grid grid-cols-3 gap-2">
                                    {(["mantenimiento", "limpieza", "inspeccion"] as const).map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setNewIssueType(type)}
                                            className={cn(
                                                "py-2 px-1 text-[10px] font-black uppercase rounded-xl border text-center transition-all cursor-pointer",
                                                newIssueType === type
                                                    ? type === "mantenimiento"
                                                        ? "bg-red-500/10 border-red-500/30 text-red-600"
                                                        : type === "limpieza"
                                                        ? "bg-accent/10 border-accent/30 text-accent"
                                                        : "bg-purple-500/10 border-purple-500/30 text-purple-600"
                                                    : "bg-[var(--bg-primary)]/40 border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-primary)]"
                                            )}
                                        >
                                            {type === "mantenimiento"
                                                ? (dict.tech?.issue_type_maintenance || "Maintenance")
                                                : type === "limpieza"
                                                ? (dict.tech?.issue_type_cleaning || "Cleaning")
                                                : (dict.tech?.issue_type_inspection || "Inspection")
                                            }
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Element selector */}
                            <div className="space-y-1">
                                <label className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider block">
                                    {dict.tech.issues_select_element}
                                </label>
                                <select
                                    value={newIssueElement}
                                    onChange={(e) => setNewIssueElement(e.target.value)}
                                    aria-label={dict.tech.issues_select_element}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent transition-colors"
                                >
                                    {issueElements.map((el) => (
                                        <option key={el.value} value={el.value}>
                                            {el.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Title */}
                            <div className="space-y-1">
                                <label htmlFor="tech-issue-title" className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider block">
                                    {dict.tech.issues_title_label}
                                </label>
                                <input
                                    id="tech-issue-title"
                                    type="text"
                                    value={newIssueTitle}
                                    onChange={(e) => setNewIssueTitle(e.target.value)}
                                    placeholder={dict.tech?.issues_title_placeholder || "e.g. Faucet leaking"}
                                    required
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-1">
                                <label htmlFor="tech-issue-description" className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider block">
                                    {dict.tech.issues_desc_label}
                                </label>
                                <textarea
                                    id="tech-issue-description"
                                    value={newIssueDescription}
                                    onChange={(e) => setNewIssueDescription(e.target.value)}
                                    placeholder={dict.tech?.issues_desc_placeholder || "Provide details about the issue..."}
                                    rows={3}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2.5 text-xs outline-none focus:border-accent transition-colors resize-none"
                                />
                            </div>

                            {/* Photo attachment */}
                            <div className="space-y-1">
                                <span className="text-[9px] uppercase font-black text-[var(--text-muted)] tracking-wider block">
                                    {dict.tech.issues_photo_label}
                                </span>
                                <div className="flex items-center gap-3">
                                    <label className="surface-control-btn flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors text-xs font-semibold">
                                        <Camera className="w-4 h-4 text-accent" />
                                        <span>{dict.tech?.issues_photo_btn || "Take photo / Attach"}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={onFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                    {newIssuePhoto && (
                                        <div className="relative w-12 h-12 rounded-lg border border-[var(--border-soft)] overflow-hidden bg-black/5">
                                            <Image
                                                src={newIssuePhoto}
                                                alt=""
                                                fill
                                                sizes="48px"
                                                className="object-cover"
                                                unoptimized
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setNewIssuePhoto("")}
                                                aria-label={dict.tech.btn_delete}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 border-none cursor-pointer flex items-center justify-center w-4 h-4"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Submit buttons */}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowNewIssueForm(false)}
                                    className="text-xs h-9 rounded-xl px-4 border border-[var(--border-color)]"
                                >
                                    {dict.tech.btn_cancel}
                                </Button>
                                <Button
                                    type="submit"
                                    className="bg-accent hover:bg-accent-light text-white font-bold text-xs h-9 rounded-xl px-4 border-none cursor-pointer"
                                >
                                    {dict.tech.issues_save}
                                </Button>
                            </div>
                        </form>
                    )}

                </div>
            )}
        </div>
    );
}
