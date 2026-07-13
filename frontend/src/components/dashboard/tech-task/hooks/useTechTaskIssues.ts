"use client";

import { useState, useMemo } from "react";
import { toast } from "@/lib/toast";
import type { Dictionary } from "@/lib/dictionary-context";
import { UploadService } from "@/services/upload.service";
import { TaskService } from "@/services/task.service";
import { appendReportedIssue } from "@/lib/task-reporting";
import type { ReportedIssue, TaskItem } from "@/types/user";

export type { ReportedIssue } from "@/types/user";

interface IssueElement {
    value: string;
    label: string;
}

interface UseTechTaskIssuesParams {
    task: TaskItem;
    dict: Dictionary;
    onStatusUpdate: () => void;
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
    handleAddIssue: (e: React.FormEvent) => Promise<void>;
    handleDeleteIssue: (issueId: string) => Promise<void>;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function useTechTaskIssues({
    task,
    dict,
    onStatusUpdate,
}: UseTechTaskIssuesParams): UseTechTaskIssuesReturn {
    const [showNewIssueForm, setShowNewIssueForm] = useState(false);
    const [newIssueType, setNewIssueType] = useState<"mantenimiento" | "limpieza" | "inspeccion">("mantenimiento");
    const [newIssueElement, setNewIssueElement] = useState("lavabo");
    const [newIssueTitle, setNewIssueTitle] = useState("");
    const [newIssueDescription, setNewIssueDescription] = useState("");
    const [newIssuePhoto, setNewIssuePhoto] = useState("");

    const reportedIssues = task.reported_issues || [];

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

    const handleAddIssue = async (e: React.FormEvent) => {
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

        try {
            await TaskService.updateTaskItem(task.id, appendReportedIssue(reportedIssues, newIssue));
            onStatusUpdate();
            toast.success(dict?.tech?.toast_issue_reported || "Issue reported successfully");
        } catch {
            toast.error("Could not report issue");
            return;
        }

        // Reset form
        setNewIssueTitle("");
        setNewIssueDescription("");
        setNewIssuePhoto("");
        setShowNewIssueForm(false);
    };

    const handleDeleteIssue = async (issueId: string) => {
        try {
            await TaskService.updateTaskItem(task.id, {
                reported_issues: reportedIssues.filter(i => i.id !== issueId),
            });
            onStatusUpdate();
            toast.success(dict?.tech?.toast_issue_deleted || "Issue deleted");
        } catch {
            toast.error("Could not delete issue");
        }
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
