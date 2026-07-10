"use client";

import { useState, useMemo } from "react";
import { toast } from "@/lib/toast";
import type { Dictionary } from "@/lib/dictionary-context";
import { UploadService } from "@/services/upload.service";

export interface ReportedIssue {
    id: string;
    type: "mantenimiento" | "limpieza" | "inspeccion";
    element: string;
    title: string;
    description: string;
    photoUrl?: string;
    createdAt: string;
}

interface IssueElement {
    value: string;
    label: string;
}

interface UseTechTaskIssuesParams {
    locationId: number;
    dict: Dictionary;
}

interface UseTechTaskIssuesReturn {
    reportedIssues: ReportedIssue[];
    showNewIssueForm: boolean;
    setShowNewIssueForm: React.Dispatch<React.SetStateAction<boolean>>;
    newIssueType: "mantenimiento" | "limpieza" | "inspeccion";
    setNewIssueType: React.Dispatch<React.SetStateAction<"mantenimiento" | "limpieza" | "inspeccion">>;
    newIssueElement: string;
    setNewIssueElement: React.Dispatch<React.SetStateAction<string>>;
    newIssueTitle: string;
    setNewIssueTitle: React.Dispatch<React.SetStateAction<string>>;
    newIssueDescription: string;
    setNewIssueDescription: React.Dispatch<React.SetStateAction<string>>;
    newIssuePhoto: string;
    setNewIssuePhoto: React.Dispatch<React.SetStateAction<string>>;
    issueElements: IssueElement[];
    handleAddIssue: (e: React.FormEvent) => void;
    handleDeleteIssue: (issueId: string) => void;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

function readStoredIssues(storageKey: string): ReportedIssue[] {
    if (typeof window === "undefined") return [];
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return [];

    try {
        return JSON.parse(saved) as ReportedIssue[];
    } catch {
        return [];
    }
}

export function useTechTaskIssues({
    locationId,
    dict,
}: UseTechTaskIssuesParams): UseTechTaskIssuesReturn {
    const [showNewIssueForm, setShowNewIssueForm] = useState(false);
    const [newIssueType, setNewIssueType] = useState<"mantenimiento" | "limpieza" | "inspeccion">("mantenimiento");
    const [newIssueElement, setNewIssueElement] = useState("lavabo");
    const [newIssueTitle, setNewIssueTitle] = useState("");
    const [newIssueDescription, setNewIssueDescription] = useState("");
    const [newIssuePhoto, setNewIssuePhoto] = useState("");

    const storageKey = `workhive_issues_location_${locationId}`;
    const [issueStore, setIssueStore] = useState(() => ({
        storageKey,
        items: readStoredIssues(storageKey),
    }));
    const reportedIssues = issueStore.storageKey === storageKey
        ? issueStore.items
        : readStoredIssues(storageKey);

    const saveIssues = (updated: ReportedIssue[]) => {
        setIssueStore({ storageKey, items: updated });
        window.localStorage.setItem(storageKey, JSON.stringify(updated));
    };

    const issueElements: IssueElement[] = useMemo(() => [
        { value: "lavabo", label: dict?.tech?.issue_element_lavabo || "Washbasin" },
        { value: "habitacion", label: dict?.tech?.issue_element_habitacion || "Room" },
        { value: "quimicos_limpieza", label: dict?.tech?.issue_element_quimicos_limpieza || "Cleaning chemicals" },
        { value: "emergency_card", label: dict?.tech?.issue_element_emergency_card || "Emergency information card" },
        { value: "extintor", label: dict?.tech?.issue_element_extintor || "Fire extinguisher" },
        { value: "botiquin", label: dict?.tech?.issue_element_botiquin || "First aid kit" },
        { value: "suelos", label: dict?.tech?.issue_element_suelos || "Floors" },
        { value: "iluminacion", label: dict?.tech?.issue_element_iluminacion || "Lighting" },
        { value: "sensor_ruido", label: dict?.tech?.issue_element_sensor_ruido || "Noise sensor" },
        { value: "alarma_humo", label: dict?.tech?.issue_element_alarma_humo || "Smoke alarm" },
    ], [dict]);

    const handleAddIssue = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newIssueTitle.trim()) {
            toast.error(dict?.tech?.toast_issue_title_required || "Please enter a title");
            return;
        }

        const newIssue: ReportedIssue = {
            id: `issue_${Date.now()}`,
            type: newIssueType,
            element: newIssueElement,
            title: newIssueTitle.trim(),
            description: newIssueDescription.trim(),
            photoUrl: newIssuePhoto || undefined,
            createdAt: new Date().toISOString(),
        };

        const updated = [newIssue, ...reportedIssues];
        saveIssues(updated);
        toast.success(dict?.tech?.toast_issue_reported || "Issue reported successfully");

        // Reset form
        setNewIssueTitle("");
        setNewIssueDescription("");
        setNewIssuePhoto("");
        setShowNewIssueForm(false);
    };

    const handleDeleteIssue = (issueId: string) => {
        const updated = reportedIssues.filter(i => i.id !== issueId);
        saveIssues(updated);
        toast.success(dict?.tech?.toast_issue_deleted || "Issue deleted");
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const uploaded = await UploadService.uploadFile(file, "location");
                setNewIssuePhoto(uploaded.url);
                toast.success(dict?.tech?.toast_photo_attached || "Photo attached successfully");
            } catch (error) {
                console.error("Could not upload issue photo", error);
                toast.error("Could not upload photo");
            }
        }
    };

    return {
        reportedIssues,
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
        handleAddIssue,
        handleDeleteIssue,
        handleFileChange,
    };
}
