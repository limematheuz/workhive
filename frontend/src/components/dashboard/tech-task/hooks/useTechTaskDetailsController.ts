"use client";

import { useMemo, useState } from "react";

import { useDictionary } from "@/lib/dictionary-context";
import { getUserTaskStatus, isTaskAssignedToUser } from "@/lib/format";
import type { Location } from "@/types/location";
import type { TaskItem, User } from "@/types/user";

import {
    formatShortDateTime,
    getLocationTypeLabel,
    getPriorityBadge,
    getServiceContextLabel,
} from "../utils";
import {
    useTechTaskAttachmentsComments,
    useTechTaskChecklist,
    useTechTaskIssues,
    useTechTaskPropertyFeatures,
    useTechTaskWorkSession,
} from "./index";
import type { TechTaskWorkMode } from "../TechTaskWorkControls";

type UseTechTaskDetailsControllerParams = {
    task: TaskItem;
    location: Location | null;
    locationName: string;
    currentUser: User;
    onBack: () => void;
    onStatusUpdate: () => void;
};

const DEFAULT_EXPANDED_PANELS = {
    problemas: false,
    detalles_propiedad: false,
    costos: false,
    suministros: false,
    detalles_tarea: true,
    etiquetas: false,
    resumen: false,
};

export function useTechTaskDetailsController({
    task,
    location,
    locationName,
    currentUser,
    onBack,
    onStatusUpdate,
}: UseTechTaskDetailsControllerParams) {
    const { dict, locale } = useDictionary();
    const [viewMode, setViewMode] = useState<"map" | "photo">("map");
    const [expandedReservation, setExpandedReservation] = useState<"checkout" | "next" | null>(null);
    const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>(DEFAULT_EXPANDED_PANELS);
    const [requisitosOpen, setRequisitosOpen] = useState(false);
    const [adjuntosOpen, setAdjuntosOpen] = useState(false);
    const [comentariosOpen, setComentariosOpen] = useState(false);

    const workSession = useTechTaskWorkSession({
        taskId: task.id,
        dict,
        onAssignmentChanged: onStatusUpdate,
    });

    const checklistState = useTechTaskChecklist({
        task,
        currentUser,
        isCurrentTaskSessionActive: workSession.isCurrentTaskSessionActive,
        onStatusUpdate,
        dict,
    });

    const issueState = useTechTaskIssues({
        locationId: task.location_id,
        dict,
    });

    const attachmentsComments = useTechTaskAttachmentsComments({
        task,
        currentUser,
        onStatusUpdate,
    });

    const propertyFeatures = useTechTaskPropertyFeatures({
        location,
        currentUser,
        locale,
        onStatusUpdate,
    });

    const priorityBadge = useMemo(() => getPriorityBadge(task.priority, locale, dict), [task.priority, locale, dict]);
    const locationTypeLabel = useMemo(() => getLocationTypeLabel(location?.location_type, locale, dict), [location?.location_type, locale, dict]);
    const serviceContextLabel = useMemo(() => getServiceContextLabel(task.service_context, locale, dict), [task.service_context, locale, dict]);
    const plannedDate = useMemo(() => formatShortDateTime(task.scheduled_start_at, locale), [task.scheduled_start_at, locale]);
    const dueDate = useMemo(() => formatShortDateTime(task.due_at, locale), [task.due_at, locale]);
    const checkoutDate = useMemo(() => formatShortDateTime(task.checkout_reservation?.check_out_at, locale), [task.checkout_reservation?.check_out_at, locale]);
    const nextCheckInDate = useMemo(() => formatShortDateTime(task.next_reservation?.check_in_at, locale), [task.next_reservation?.check_in_at, locale]);

    const userStatus = useMemo(() => getUserTaskStatus(task, currentUser.id), [task, currentUser.id]);
    const isAssignedToCurrentUser = useMemo(
        () => isTaskAssignedToUser(task, currentUser.id),
        [currentUser.id, task]
    );
    const canStartWork = useMemo(() => {
        return ["accepted", "progress", "review"].includes(task.status)
            && isAssignedToCurrentUser
            && ["pending", "accepted", "progress"].includes(userStatus);
    }, [isAssignedToCurrentUser, task.status, userStatus]);

    const workMode: TechTaskWorkMode = workSession.isCurrentTaskSessionActive ? "finish"
        : workSession.hasAnotherActiveSession ? "blocked-other-session"
            : canStartWork ? "start"
                : userStatus === "completed" ? "completed"
                    : !isAssignedToCurrentUser ? "not-assigned"
                        : "accept-first";

    return {
        location,
        locationName,
        viewMode,
        setViewMode,
        onBack,
        dict,
        headerInfoProps: {
            task,
            location,
            locationName,
            locationTypeLabel,
            serviceContextLabel,
            priorityBadge,
            plannedDate,
            dueDate,
            checkoutDate,
            locale,
            taskWorkSeconds: workSession.taskWorkSeconds,
            activeWorkers: workSession.activeWorkers,
            workers: workSession.workers,
            isCurrentTaskSessionActive: workSession.isCurrentTaskSessionActive,
            personalElapsedSeconds: workSession.personalElapsedSeconds,
            isParsedChecklist: checklistState.isParsedChecklist,
        },
        countersProps: {
            locale,
            completedCount: checklistState.completedCount,
            totalCount: checklistState.totalCount,
            attachmentsCount: attachmentsComments.attachments.length,
            commentsCount: attachmentsComments.comments.length,
            onOpenRequisitos: () => setRequisitosOpen(true),
            onOpenAdjuntos: () => setAdjuntosOpen(true),
            onOpenComentarios: () => setComentariosOpen(true),
        },
        reservationProps: {
            task,
            locale,
            checkoutDate,
            nextCheckInDate,
            expandedReservation,
            setExpandedReservation,
        },
        propertyPanelsProps: {
            locale,
            issuesProps: {
                expanded: expandedPanels.problemas,
                onToggle: () => setExpandedPanels((panels) => ({ ...panels, problemas: !panels.problemas })),
                reportedIssues: issueState.reportedIssues,
                showNewIssueForm: issueState.showNewIssueForm,
                setShowNewIssueForm: issueState.setShowNewIssueForm,
                newIssueType: issueState.newIssueType,
                setNewIssueType: issueState.setNewIssueType,
                newIssueElement: issueState.newIssueElement,
                setNewIssueElement: issueState.setNewIssueElement,
                newIssueTitle: issueState.newIssueTitle,
                setNewIssueTitle: issueState.setNewIssueTitle,
                newIssueDescription: issueState.newIssueDescription,
                setNewIssueDescription: issueState.setNewIssueDescription,
                newIssuePhoto: issueState.newIssuePhoto,
                setNewIssuePhoto: issueState.setNewIssuePhoto,
                issueElements: issueState.issueElements,
                onAddIssue: issueState.handleAddIssue,
                onDeleteIssue: issueState.handleDeleteIssue,
                onFileChange: issueState.handleFileChange,
            },
            propertyProps: {
                expanded: expandedPanels.detalles_propiedad,
                onToggle: () => setExpandedPanels((panels) => ({ ...panels, detalles_propiedad: !panels.detalles_propiedad })),
                location,
                locationName,
                features: propertyFeatures.features,
                isEditingFeatures: propertyFeatures.isEditingFeatures,
                setIsEditingFeatures: propertyFeatures.setIsEditingFeatures,
                canEditLocationDetails: propertyFeatures.canEditLocationDetails,
                onSaveFeatures: propertyFeatures.handleSaveFeatures,
            },
        },
        workControlsProps: {
            mode: workMode,
            updatingStatus: workSession.updatingStatus,
            dict,
            onStartWork: workSession.handleStartWork,
            onFinishWork: () => workSession.handleFinishWork({
                ownTotalCount: checklistState.ownTotalCount,
                ownCompletedCount: checklistState.ownCompletedCount,
                onBack,
                onStatusUpdate,
            }),
        },
        dialogsProps: {
            requisitosOpen,
            setRequisitosOpen,
            adjuntosOpen,
            setAdjuntosOpen,
            comentariosOpen,
            setComentariosOpen,
            checklist: checklistState.checklist,
            categoryItems: checklistState.categoryItems,
            activeCategory: checklistState.activeCategory,
            setActiveCategory: checklistState.setActiveCategory,
            currentTaskSessionActive: workSession.isCurrentTaskSessionActive,
            dict,
            expandedItem: checklistState.expandedItem,
            setExpandedItem: checklistState.setExpandedItem,
            completedHidden: checklistState.hideCompleted,
            setCompletedHidden: checklistState.setHideCompleted,
            uploadingChecklistItem: checklistState.uploadingChecklistItem,
            availableAssignees: checklistState.availableAssignees,
            getCategoryForItem: checklistState.getCategoryForItem,
            onAnswer: checklistState.handleAnswer,
            onNoteChange: checklistState.handleNoteChange,
            onPersistNote: checklistState.persistChecklistNote,
            onChecklistPhoto: checklistState.handleChecklistPhoto,
            onResetChecklist: checklistState.handleResetChecklist,
            onAddChecklistItem: checklistState.handleAddChecklistItem,
            attachments: attachmentsComments.attachments,
            uploadingAttachment: attachmentsComments.uploadingAttachment,
            onUploadAttachment: attachmentsComments.handleUploadAttachment,
            onDeleteAttachment: attachmentsComments.handleDeleteAttachment,
            comments: attachmentsComments.comments,
            locale,
            newCommentText: attachmentsComments.newCommentText,
            setNewCommentText: attachmentsComments.setNewCommentText,
            onAddComment: attachmentsComments.handleAddComment,
            onDeleteComment: attachmentsComments.handleDeleteComment,
        },
    };
}
