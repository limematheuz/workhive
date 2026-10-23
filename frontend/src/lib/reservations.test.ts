import assert from "node:assert/strict";
import test from "node:test";

import {
    canLinkTaskReservations,
    canManageLocationReservations,
    createReservationForm,
    createReservationPayload,
    filterReservations,
    getReservableLocations,
    getReservationProviderOptions,
    hasReservationCheckedOut,
} from "../features/reservations/reservation-helpers.ts";
import { reservationSaveErrorMessage } from "../features/reservations/reservation-errors.ts";
import type { Location } from "../types/location.ts";
import type { Reservation } from "../types/reservation.ts";

function location(overrides: Partial<Location>): Location {
    return {
        id: 1,
        name: "Casa Javier",
        address: "Carrer Ordina, 9",
        city: "L'Escala",
        is_active: true,
        ...overrides,
    };
}

function reservation(overrides: Partial<Reservation>): Reservation {
    return {
        id: 1,
        location_id: 1,
        owner_company_id: 10,
        check_in_at: "2026-08-10T16:00:00.000Z",
        check_out_at: "2026-08-12T11:00:00.000Z",
        guest_count: 3,
        stay_type: "guest",
        status: "confirmed",
        source: "manual",
        external_reference: null,
        notes: null,
        cleaning_required: true,
        created_at: "2026-07-01T10:00:00.000Z",
        updated_at: "2026-07-01T10:00:00.000Z",
        assigned_company_id: null,
        assigned_company_name: null,
        cleaning_status: null,
        cleaning_scheduled_at: null,
        ...overrides,
    };
}

const defaultFilters = {
    search: "",
    location: "ALL",
    provider: "ALL",
    cleaning: "ALL",
    date: "ALL",
    year: "ALL",
    month: "ALL",
    showCancelled: false,
} as const;

test("reservation management requires explicit permission or matching company", () => {
    assert.equal(
        canManageLocationReservations(location({ can_manage_reservations: true }), null),
        true,
    );
    assert.equal(
        canManageLocationReservations(location({ owner_company_id: 10 }), 10),
        true,
    );
    assert.equal(
        canManageLocationReservations(location({ owner_company_id: 10 }), 20),
        false,
    );
    assert.equal(canManageLocationReservations(location({}), null), false);
    assert.equal(getReservableLocations([location({}), location({ id: 2, owner_company_id: 10 })], 10).length, 1);
});

test("task reservation links fail closed unless the API grants the issuer capability", () => {
    assert.equal(
        canLinkTaskReservations(location({ can_manage_reservations: true })),
        true,
    );
    assert.equal(
        canLinkTaskReservations(location({ owner_company_id: 10 })),
        false,
    );
    assert.equal(canLinkTaskReservations(location({})), false);
});

test("reservation form preserves editable values and payload nulls optional fields", () => {
    const existing = reservation({
        cleaning_scheduled_at: "2026-08-12T12:30:00.000Z",
        assigned_company_id: 30,
        notes: "Late checkout",
    });
    const form = createReservationForm(existing);

    assert.equal(form.locationId, "1");
    assert.equal(form.guestCount, "3");
    assert.equal(form.assignedUserId, "30");
    assert.equal(form.notes, "Late checkout");

    const payload = createReservationPayload({
        ...form,
        notes: "",
        cleaningRequired: false,
        assignedUserId: "",
    }, existing);

    assert.equal(payload.location_id, 1);
    assert.equal(payload.guest_count, 3);
    assert.equal(payload.notes, null);
    assert.equal(payload.assigned_company_id, null);
    assert.equal(payload.cleaning_scheduled_at, null);
    assert.equal(payload.source, "manual");
});

test("reservation conflicts explain the correction in the selected language", () => {
    const overlap = new Error("This reservation overlaps another active reservation at the location");

    assert.equal(
        reservationSaveErrorMessage(overlap, "es", "No se pudo guardar"),
        "Las fechas coinciden con otra reserva activa de esta ubicación. Revisa la entrada y la salida.",
    );
    assert.equal(
        reservationSaveErrorMessage(overlap, "en", "Could not save"),
        "These dates overlap another active reservation at this location. Review check-in and check-out.",
    );
    const invalidRange = new Error(
        "body: Value error, La fecha de salida (check-out) debe ser posterior a la fecha de entrada (check-in).",
    );
    assert.equal(
        reservationSaveErrorMessage(invalidRange, "es", "No se pudo guardar"),
        "La salida debe ser posterior a la entrada. Corrige las fechas o las horas.",
    );
    assert.equal(
        reservationSaveErrorMessage(invalidRange, "en", "Could not save"),
        "Check-out must be after check-in. Adjust the dates or times.",
    );
    assert.equal(
        reservationSaveErrorMessage(new Error("Not enough permissions"), "es", "No se pudo guardar"),
        "Not enough permissions",
    );
    assert.equal(reservationSaveErrorMessage(null, "es", "No se pudo guardar"), "No se pudo guardar");
});

test("reservation provider options de-duplicate and sort collaborator companies", () => {
    assert.deepEqual(
        getReservationProviderOptions([
            reservation({ assigned_company_id: 40, assigned_company_name: "Zulu Clean" }),
            reservation({ id: 2, assigned_company_id: 30, assigned_company_name: "Alpha Clean" }),
            reservation({ id: 3, assigned_company_id: 40, assigned_company_name: "Zulu Clean" }),
        ]),
        [
            { id: 30, name: "Alpha Clean" },
            { id: 40, name: "Zulu Clean" },
        ],
    );
});

test("reservation filters enforce role visibility, search and cancelled visibility", () => {
    const companyId = 10;
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);
    const activeStay = {
        check_in_at: checkIn.toISOString(),
        check_out_at: checkOut.toISOString(),
    };
    const visibleLocation = location({ id: 1, owner_company_id: 10 });
    const externalLocation = location({ id: 2, owner_company_id: 20 });
    const locationMap = new Map([
        [visibleLocation.id, visibleLocation],
        [externalLocation.id, externalLocation],
    ]);
    const visible = reservation({ id: 1, notes: "VIP guest", ...activeStay });
    const assignedToCompany = reservation({
        id: 2,
        location_id: 2,
        owner_company_id: 20,
        assigned_company_id: 10,
        assigned_company_name: "Ownet",
        ...activeStay,
    });
    const hidden = reservation({
        id: 3,
        location_id: 2,
        owner_company_id: 20,
        assigned_company_id: null,
    });
    const cancelled = reservation({ id: 4, status: "cancelled" });

    const filtered = filterReservations({
        reservations: [hidden, assignedToCompany, cancelled, visible],
        locationMap,
        companyId,
        filters: { ...defaultFilters, search: "vip" },
        viewMode: "active",
    });

    assert.deepEqual(filtered.map(item => item.id), [1]);

    const active = filterReservations({
        reservations: [hidden, assignedToCompany, cancelled, visible],
        locationMap,
        companyId,
        filters: { ...defaultFilters, date: "UPCOMING" },
        viewMode: "active",
    });

    assert.deepEqual(active.map(item => item.id), [2, 1]);
});

test("completed cleaning does not hide a future stay before checkout", () => {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);
    const futureStay = reservation({
        cleaning_status: "completed",
        check_in_at: checkIn.toISOString(),
        check_out_at: checkOut.toISOString(),
    });
    assert.equal(hasReservationCheckedOut(futureStay), false);
    const options = {
        reservations: [futureStay],
        locationMap: new Map([[1, location({ owner_company_id: 10 })]]),
        companyId: 10,
        filters: { ...defaultFilters, date: "UPCOMING" },
    };

    assert.deepEqual(filterReservations({ ...options, viewMode: "active" }).map(item => item.id), [1]);
    assert.deepEqual(filterReservations({ ...options, viewMode: "history" }), []);
    assert.deepEqual(
        filterReservations({
            ...options,
            reservations: [{ ...futureStay, status: "cancelled" }],
            filters: { ...defaultFilters, date: "UPCOMING", showCancelled: true },
            viewMode: "history",
        }).map(item => item.id),
        [1],
    );
});
