import assert from "node:assert/strict";
import test from "node:test";

import {
    HEADER_ALERT_BADGE_CLASS,
    SIDEBAR_ALERT_COLLAPSED_BADGE_CLASS,
    SIDEBAR_ALERT_LINK_ACTIVE_CLASS,
    SIDEBAR_ALERT_LINK_CLASS,
    SIDEBAR_ALERT_PULSE_CLASS,
    SIDEBAR_ALERT_TRAILING_BADGE_CLASS,
    formatSidebarAlertCount,
    shouldShowTaskAlertsOnHref,
} from "./sidebar-alerts.ts";

test("formatSidebarAlertCount caps counts above nine", () => {
    assert.equal(formatSidebarAlertCount(0), "0");
    assert.equal(formatSidebarAlertCount(1), "1");
    assert.equal(formatSidebarAlertCount(9), "9");
    assert.equal(formatSidebarAlertCount(10), "9+");
    assert.equal(formatSidebarAlertCount(99), "9+");
});

test("task alerts appear on Resumen and Tareas only", () => {
    assert.equal(shouldShowTaskAlertsOnHref("/dashboard"), true);
    assert.equal(shouldShowTaskAlertsOnHref("/dashboard/tasks"), true);
    assert.equal(shouldShowTaskAlertsOnHref("/dashboard/calendar"), false);
    assert.equal(shouldShowTaskAlertsOnHref("/dashboard/reservations"), false);
    assert.equal(shouldShowTaskAlertsOnHref("/dashboard/tasks/extra"), false);
    assert.equal(shouldShowTaskAlertsOnHref("/dashboard/profile"), false);
});

test("sidebar and header alert badges are fully round and have no white outer ring", () => {
    for (const className of [
        SIDEBAR_ALERT_TRAILING_BADGE_CLASS,
        SIDEBAR_ALERT_COLLAPSED_BADGE_CLASS,
        HEADER_ALERT_BADGE_CLASS,
    ]) {
        assert.match(className, /\brounded-full\b/);
        assert.match(className, /\bh-5\b/);
        assert.match(className, /\bw-5\b/);
        assert.doesNotMatch(className, /\bring(?:-\S+)?\b/);
        assert.doesNotMatch(className, /\bpx-\S+\b/);
        assert.doesNotMatch(className, /\bpy-\S+\b/);
        assert.doesNotMatch(className, /\bmin-h-\S+\b/);
        assert.doesNotMatch(className, /\bmin-w-\S+\b/);
    }
});

test("open sidebar keeps alerts only on the trailing right badge", () => {
    assert.match(SIDEBAR_ALERT_TRAILING_BADGE_CLASS, /\bml-auto\b/);
    assert.match(SIDEBAR_ALERT_TRAILING_BADGE_CLASS, /\bshrink-0\b/);
    assert.match(SIDEBAR_ALERT_TRAILING_BADGE_CLASS, /\brelative\b/);
    assert.doesNotMatch(SIDEBAR_ALERT_TRAILING_BADGE_CLASS, /\babsolute\b/);
});

test("sidebar alert pulse matches the notification panel ping style", () => {
    assert.match(SIDEBAR_ALERT_PULSE_CLASS, /\banimate-ping\b/);
    assert.match(SIDEBAR_ALERT_PULSE_CLASS, /\brounded-full\b/);
    assert.match(SIDEBAR_ALERT_PULSE_CLASS, /\babsolute\b/);
});

test("collapsed sidebar badge stays on the link corner without overlapping a label", () => {
    assert.match(SIDEBAR_ALERT_COLLAPSED_BADGE_CLASS, /\babsolute\b/);
    assert.match(SIDEBAR_ALERT_COLLAPSED_BADGE_CLASS, /-right-/);
    assert.match(SIDEBAR_ALERT_COLLAPSED_BADGE_CLASS, /-top-/);
});

test("alert badge and alert link stack above the nav link container", () => {
    assert.match(SIDEBAR_ALERT_TRAILING_BADGE_CLASS, /\bz-20\b/);
    assert.match(SIDEBAR_ALERT_COLLAPSED_BADGE_CLASS, /\bz-20\b/);
    assert.match(SIDEBAR_ALERT_TRAILING_BADGE_CLASS, /\boverflow-visible\b/);
    assert.match(SIDEBAR_ALERT_LINK_CLASS, /\bz-0\b/);
    assert.match(SIDEBAR_ALERT_LINK_ACTIVE_CLASS, /\bz-10\b/);
    assert.match(SIDEBAR_ALERT_LINK_ACTIVE_CLASS, /\boverflow-visible\b/);
});
