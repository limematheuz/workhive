"use client";

import React from "react";
import { OperationsCalendar } from "@/components/dashboard/OperationsCalendar";
import { TaskItem } from "@/services/task.service";
import { Location } from "@/services/location.service";
import { User } from "@/types/user";

interface TasksKanbanProps {
    tasks: TaskItem[];
    locations: Location[];
    users: User[];
    onTaskUpdate: () => void;
    currentUser: User | null;
    onCreateTask?: () => void;
}

export function TasksKanban({
    tasks,
    locations,
    users,
    onTaskUpdate,
    currentUser,
    onCreateTask,
}: TasksKanbanProps) {
    return (
        <div className="-mx-2">
            <OperationsCalendar
                tasks={tasks}
                locations={locations}
                users={users}
                onTaskUpdate={onTaskUpdate}
                currentUser={currentUser}
                onCreateTask={onCreateTask}
            />
        </div>
    );
}
