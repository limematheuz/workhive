"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { classifyReadError, type ReadErrorKind } from "@/lib/read-recovery";
import { ClientService, type Client } from "@/services/client.service";
import { ServiceContractService } from "@/services/service-contract.service";
import type { ServiceContract } from "@/types/service-contract";

type Snapshot = { contracts: ServiceContract[]; clients: Client[]; confirmed: boolean; refreshing: boolean; error: ReadErrorKind | null };
const emptySnapshot = (): Snapshot => ({ contracts: [], clients: [], confirmed: false, refreshing: true, error: null });

/** The parent keys this list and its dialogs by authenticated workspace. */
export function useContractList(workspaceKey: string) {
    const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
    const request = useRef({ version: 0 });
    useEffect(() => {
        const pending = request.current;
        return () => { pending.version++; };
    }, []);
    const reload = useCallback(async () => {
        const version = ++request.current.version;
        const readContext = `contracts:${workspaceKey}:${version}`;
        setSnapshot(current => ({ ...current, refreshing: true }));
        try {
            const [contracts, clients] = await Promise.all([
                ServiceContractService.getContracts({}, readContext),
                ClientService.getClients(true, readContext).catch(() => [] as Client[]),
            ]);
            if (version !== request.current.version) return;
            setSnapshot({ contracts, clients, confirmed: true, refreshing: false, error: null });
        } catch (error) {
            if (version !== request.current.version) return;
            const kind = classifyReadError(error);
            setSnapshot(current => ({ ...(kind === "denied" ? emptySnapshot() : current), refreshing: false, error: kind }));
        }
    }, [workspaceKey]);
    const updateContract = useCallback((updated: ServiceContract) => {
        setSnapshot(current => ({ ...current, contracts: current.contracts.map(item => item.id === updated.id ? updated : item) }));
    }, []);
    return { ...snapshot, loading: snapshot.refreshing && !snapshot.confirmed && !snapshot.error, reload, updateContract };
}
