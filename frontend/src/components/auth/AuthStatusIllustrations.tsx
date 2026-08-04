/** Original flat illustrations for auth success / error feedback. */

type IllustrationProps = {
    className?: string;
};

/** Soft celebration: check badge + hive spark, brand blues. */
export function LoginSuccessIllustration({ className }: IllustrationProps) {
    return (
        <svg
            className={className}
            viewBox="0 0 200 140"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <ellipse cx="100" cy="118" rx="54" ry="8" fill="currentColor" opacity="0.08" />
            {/* soft blobs */}
            <circle cx="42" cy="38" r="10" fill="var(--accent-color)" opacity="0.18" />
            <circle cx="168" cy="46" r="8" fill="var(--accent-color)" opacity="0.14" />
            <circle cx="156" cy="92" r="6" fill="var(--accent-color)" opacity="0.2" />
            {/* confetti */}
            <rect x="28" y="58" width="4" height="10" rx="1" fill="var(--accent-color)" opacity="0.55" transform="rotate(-18 28 58)" />
            <rect x="170" y="62" width="4" height="9" rx="1" fill="var(--accent-color)" opacity="0.45" transform="rotate(22 170 62)" />
            <circle cx="48" cy="78" r="2.5" fill="var(--accent-color)" opacity="0.5" />
            <circle cx="160" cy="34" r="2" fill="var(--accent-color)" opacity="0.55" />
            <path d="M34 92l6-2.5 2.5 6-6 2.5-2.5-6z" fill="var(--accent-color)" opacity="0.4" />
            <path d="M172 84l5 3-3 5-5-3 3-5z" fill="var(--accent-color)" opacity="0.35" />
            {/* main badge */}
            <circle cx="100" cy="64" r="36" fill="var(--accent-color)" opacity="0.12" />
            <circle cx="100" cy="64" r="28" fill="var(--accent-color)" opacity="0.18" />
            <circle cx="100" cy="64" r="22" fill="var(--accent-color)" />
            <path
                d="M88 64.5l7.5 7.5L113 54"
                stroke="#fff"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* small honeycomb accent */}
            <path
                d="M128 28l6 3.5v7l-6 3.5-6-3.5v-7l6-3.5z"
                fill="var(--accent-color)"
                opacity="0.55"
            />
            <path
                d="M66 24l5 3v6l-5 3-5-3v-6l5-3z"
                fill="var(--accent-color)"
                opacity="0.35"
            />
        </svg>
    );
}

/** Soft denial: lock + gentle “no entry” cue, brand-safe neutrals + soft red. */
export function LoginErrorIllustration({ className }: IllustrationProps) {
    return (
        <svg
            className={className}
            viewBox="0 0 200 140"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <ellipse cx="100" cy="118" rx="54" ry="8" fill="currentColor" opacity="0.08" />
            <circle cx="44" cy="42" r="9" fill="currentColor" opacity="0.06" />
            <circle cx="164" cy="50" r="7" fill="currentColor" opacity="0.06" />
            {/* lock body */}
            <rect
                x="72"
                y="58"
                width="56"
                height="44"
                rx="12"
                fill="var(--btn-cancel-bg)"
                stroke="var(--btn-cancel-border)"
                strokeWidth="2"
            />
            <path
                d="M84 58V48a16 16 0 0 1 32 0v10"
                stroke="var(--btn-cancel-text)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.85"
            />
            <circle cx="100" cy="78" r="5" fill="var(--btn-cancel-text)" opacity="0.9" />
            <rect x="98" y="82" width="4" height="10" rx="2" fill="var(--btn-cancel-text)" opacity="0.9" />
            {/* soft X sparkles */}
            <path d="M40 70l8 8M48 70l-8 8" stroke="var(--btn-cancel-text)" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
            <path d="M158 66l7 7M165 66l-7 7" stroke="var(--btn-cancel-text)" strokeWidth="2.2" strokeLinecap="round" opacity="0.4" />
            {/* key hint floating */}
            <g opacity="0.55" transform="translate(138 88) rotate(-25)">
                <circle cx="0" cy="0" r="5" stroke="var(--btn-cancel-text)" strokeWidth="2" />
                <path d="M5 0h14" stroke="var(--btn-cancel-text)" strokeWidth="2" strokeLinecap="round" />
                <path d="M14 -3v3M18 -3v3" stroke="var(--btn-cancel-text)" strokeWidth="2" strokeLinecap="round" />
            </g>
        </svg>
    );
}
