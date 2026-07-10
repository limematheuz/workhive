import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDictionary } from "@/lib/dictionary-context"
import { LocationFormRoomItem } from "./location-form-types"

interface LocationFormRoomsSectionProps {
    roomsList: LocationFormRoomItem[]
    totalCapacity: number
    onAddRoom: () => void
    onUpdateBedCount: (
        roomIndex: number,
        bedType: "double_beds" | "single_beds" | "bunk_beds",
        change: number
    ) => void
    onRoomNameChange: (roomIndex: number, name: string) => void
    onRemoveRoom: (roomId: string | number | undefined) => void
}

export function LocationFormRoomsSection({
    roomsList,
    totalCapacity,
    onAddRoom,
    onUpdateBedCount,
    onRoomNameChange,
    onRemoveRoom,
}: LocationFormRoomsSectionProps) {
    const { dict } = useDictionary()

    return (
        <div className="p-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {dict.locations.form.rooms_label}
                </h4>
                <Button
                    type="button"
                    onClick={onAddRoom}
                    size="sm"
                    className="bg-accent/10 hover:bg-accent/20 text-accent text-2xs font-black uppercase tracking-wide px-3 py-1.5 rounded-lg border-0 transition-all cursor-pointer"
                >
                    {dict.locations.form.rooms_add}
                </Button>
            </div>

            {roomsList.length === 0 ? (
                <p className="text-2xs text-[var(--text-muted)] italic pl-1">
                    {dict.locations.form.rooms_empty}
                </p>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {roomsList.map((room, index) => {
                        const roomCap = room.double_beds * 2 + room.single_beds * 1 + room.bunk_beds * 2
                        return (
                            <div key={room.id} className="p-3 bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-xl space-y-3 relative">
                                <div className="flex items-center justify-between gap-3">
                                    <Input
                                        type="text"
                                        value={room.name}
                                        onChange={(e) => onRoomNameChange(index, e.target.value)}
                                        className="h-8 py-1 px-2.5 text-xs font-bold bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] w-full max-w-[200px]"
                                    />
                                    <div className="flex items-center gap-2">
                                        <span className="text-3xs font-black uppercase bg-accent/10 text-accent px-2 py-0.5 rounded-md">
                                            {dict.locations.form.rooms_capacity.replace("{count}", roomCap.toString())}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => onRemoveRoom(room.id)}
                                            className="text-red-500 hover:text-red-700 font-bold text-sm bg-transparent hover:bg-red-500/10 w-6 h-6 flex items-center justify-center rounded-lg transition-colors border-0 cursor-pointer"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    <div className="flex flex-col items-center p-2 bg-[var(--bg-tertiary)] rounded-lg">
                                        <span className="text-[10px] font-bold text-[var(--text-muted)] mb-1">{dict.locations.form.rooms_double}</span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => onUpdateBedCount(index, "double_beds", -1)}
                                                className="w-5 h-5 flex items-center justify-center rounded-md bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-xs text-[var(--text-main)] hover:bg-[var(--border-soft)]"
                                            >
                                                -
                                            </button>
                                            <span className="text-xs font-bold text-[var(--text-main)] w-4 text-center">{room.double_beds}</span>
                                            <button
                                                type="button"
                                                onClick={() => onUpdateBedCount(index, "double_beds", 1)}
                                                className="w-5 h-5 flex items-center justify-center rounded-md bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-xs text-[var(--text-main)] hover:bg-[var(--border-soft)]"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center p-2 bg-[var(--bg-tertiary)] rounded-lg">
                                        <span className="text-[10px] font-bold text-[var(--text-muted)] mb-1">{dict.locations.form.rooms_single}</span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => onUpdateBedCount(index, "single_beds", -1)}
                                                className="w-5 h-5 flex items-center justify-center rounded-md bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-xs text-[var(--text-main)] hover:bg-[var(--border-soft)]"
                                            >
                                                -
                                            </button>
                                            <span className="text-xs font-bold text-[var(--text-main)] w-4 text-center">{room.single_beds}</span>
                                            <button
                                                type="button"
                                                onClick={() => onUpdateBedCount(index, "single_beds", 1)}
                                                className="w-5 h-5 flex items-center justify-center rounded-md bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-xs text-[var(--text-main)] hover:bg-[var(--border-soft)]"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center p-2 bg-[var(--bg-tertiary)] rounded-lg">
                                        <span className="text-[10px] font-bold text-[var(--text-muted)] mb-1">{dict.locations.form.rooms_bunk}</span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => onUpdateBedCount(index, "bunk_beds", -1)}
                                                className="w-5 h-5 flex items-center justify-center rounded-md bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-xs text-[var(--text-main)] hover:bg-[var(--border-soft)]"
                                            >
                                                -
                                            </button>
                                            <span className="text-xs font-bold text-[var(--text-main)] w-4 text-center">{room.bunk_beds}</span>
                                            <button
                                                type="button"
                                                onClick={() => onUpdateBedCount(index, "bunk_beds", 1)}
                                                className="w-5 h-5 flex items-center justify-center rounded-md bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-xs text-[var(--text-main)] hover:bg-[var(--border-soft)]"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {roomsList.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-accent/5 border border-accent/10 mt-2">
                    <span className="text-2xs font-black uppercase text-accent tracking-wider">
                        {dict.locations.form.rooms_total_cap_label}
                    </span>
                    <span className="text-xs font-black text-accent">
                        {dict.locations.form.rooms_total_cap_val.replace("{count}", totalCapacity.toString())}
                    </span>
                </div>
            )}
        </div>
    )
}
