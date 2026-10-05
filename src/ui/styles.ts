const STYLES = `
        .notification-btn {
            display: inline-block;
            width: 100%;
            padding: 12px 24px;
            background: #fff;
            border: 1px solid #111827;
            border-radius: 8px;
            color: #111827;
            font: inherit;
            text-align: center;
            text-transform: uppercase;
            cursor: pointer;
        }
        .notification-btn:hover {
            background: #111827;
            color: #fff;
        }
        #twc-nm-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: var(--twc-nm-overlay-bg, rgba(17, 17, 17, 0.55));
            opacity: 0;
            visibility: hidden;
            transition: opacity var(--twc-nm-transition, 200ms ease);
        }
        #twc-nm-overlay.is-open {
            opacity: 1;
            visibility: visible;
        }
        #twc-nm-overlay * {
            box-sizing: border-box;
        }
        #twc-nm-overlay .twc-nm-card {
            position: relative;
            width: 100%;
            max-width: 400px;
            max-height: calc(100vh - 32px);
            overflow-y: auto;
            padding: var(--twc-nm-padding, 24px);
            background: var(--twc-nm-bg, #fff);
            color: var(--twc-nm-text, #111827);
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
            font: inherit;
            font-family: var(--twc-nm-font, inherit);
            transform: translateY(8px);
            transition: transform var(--twc-nm-transition, 200ms ease);
        }
        #twc-nm-overlay.is-open .twc-nm-card {
            transform: translateY(0);
        }
        /* Panel mode: same blocking backdrop, docked to the right edge and
           full height instead of centred. Declared after the modal rules so
           the shared properties are overridden. */
        #twc-nm-overlay.twc-nm--panel {
            align-items: stretch;
            justify-content: flex-end;
            padding: 0;
        }
        #twc-nm-overlay.twc-nm--panel .twc-nm-card {
            width: var(--twc-nm-panel-width, 420px);
            max-width: 100%;
            max-height: none;
            border-radius: 0;
            box-shadow: var(--twc-nm-panel-shadow, -10px 0 40px rgba(0, 0, 0, 0.18));
            transform: translateX(100%);
        }
        /* Needs the extra class to beat both the .is-open rule above and the
           panel's own resting transform. */
        #twc-nm-overlay.twc-nm--panel.is-open .twc-nm-card {
            transform: translateX(0);
        }
        @media (max-width: 480px) {
            #twc-nm-overlay.twc-nm--panel .twc-nm-card {
                width: var(--twc-nm-panel-width-mobile, 100%);
            }
        }
        /* Groups the title and close button so a theme can lay them out as a
           row. With no border it changes nothing: the close button stays
           positioned against the card. */
        #twc-nm-overlay .twc-nm-header {
            border-bottom: var(--twc-nm-header-border, none);
        }
        /* Layout below is never themed — it keeps the close button usable
           whatever classes a theme attaches. Cosmetics follow :not(themed). */
        #twc-nm-overlay .twc-nm-close {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 32px;
            height: 32px;
            min-width: 0;
            min-height: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 0;
            border: none;
            background: transparent;
            box-shadow: none;
            text-indent: 0;
            line-height: 1;
            opacity: 1;
            visibility: visible;
            cursor: pointer;
        }
        #twc-nm-overlay .twc-nm-close:where(:not(.twc-nm-themed)) {
            border-radius: 6px;
            color: var(--twc-nm-muted, #6b7280);
        }
        /* The icon is an inline SVG rather than a text glyph so host-theme
           button resets (font-size: 0, icon fonts, text-indent) can't hide it. */
        #twc-nm-overlay .twc-nm-close svg {
            display: block;
            width: 16px;
            height: 16px;
            flex: none;
            pointer-events: none;
        }
        #twc-nm-overlay .twc-nm-close::before,
        #twc-nm-overlay .twc-nm-close::after {
            content: none;
        }
        #twc-nm-overlay .twc-nm-close:where(:not(.twc-nm-themed)):hover {
            background: #f3f4f6;
            color: var(--twc-nm-text, #111827);
        }
        #twc-nm-overlay .twc-nm-title {
            margin: 0 32px 4px 0;
        }
        #twc-nm-overlay .twc-nm-title:where(:not(.twc-nm-themed)) {
            font-size: 18px;
            font-weight: 600;
        }
        #twc-nm-overlay .twc-nm-text {
            margin: 0 0 16px;
        }
        #twc-nm-overlay .twc-nm-text:where(:not(.twc-nm-themed)) {
            font-size: 14px;
            line-height: 1.5;
            color: var(--twc-nm-muted, #6b7280);
        }
        #twc-nm-overlay .twc-nm-form {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        #twc-nm-overlay .twc-nm-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        #twc-nm-overlay .twc-nm-label:where(:not(.twc-nm-themed)) {
            font-size: 13px;
            font-weight: 500;
            color: #374151;
        }
        #twc-nm-overlay .twc-nm-input,
        #twc-nm-overlay .twc-nm-select {
            width: 100%;
        }
        /* The shorthand resets every background sub-property, so host CSS
           can't leak into an unconfigured widget; the select's arrow is added
           by the rule after it. */
        #twc-nm-overlay .twc-nm-input:where(:not(.twc-nm-themed)),
        #twc-nm-overlay .twc-nm-select:where(:not(.twc-nm-themed)) {
            padding: 10px 12px;
            font-size: 14px;
            font-family: inherit;
            color: var(--twc-nm-text, #111827);
            background: #fff;
            border: 1px solid var(--twc-nm-border, #e5e7eb);
            border-radius: var(--twc-nm-radius, 8px);
        }
        #twc-nm-overlay .twc-nm-input:where(:not(.twc-nm-themed)):focus,
        #twc-nm-overlay .twc-nm-select:where(:not(.twc-nm-themed)):focus {
            outline: none;
            border-color: var(--twc-nm-text, #111827);
            box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
        }
        #twc-nm-overlay .twc-nm-select {
            appearance: none;
            -webkit-appearance: none;
            cursor: pointer;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
        }
        /* After the shared padding above, which it must override. */
        #twc-nm-overlay .twc-nm-select:where(:not(.twc-nm-themed)) {
            padding-right: 36px;
        }
        #twc-nm-overlay .twc-nm-checks {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        #twc-nm-overlay .twc-nm-check {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #374151;
            cursor: pointer;
        }
        #twc-nm-overlay .twc-nm-check input {
            width: 16px;
            height: 16px;
            margin: 0;
        }
        #twc-nm-overlay .twc-nm-check input:where(:not(.twc-nm-themed)) {
            accent-color: var(--twc-nm-text, #111827);
        }
        #twc-nm-overlay .twc-nm-status {
            font-size: 13px;
            line-height: 1.5;
            padding: 10px 12px;
            border-radius: var(--twc-nm-radius, 8px);
        }
        #twc-nm-overlay .twc-nm-status--error {
            color: #b91c1c;
            background: #fef2f2;
        }
        #twc-nm-overlay .twc-nm-status--success {
            color: #15803d;
            background: #f0fdf4;
        }
        #twc-nm-overlay .twc-nm-status--info {
            color: #374151;
            background: #f3f4f6;
        }
        #twc-nm-overlay .twc-nm-submit {
            width: 100%;
            cursor: pointer;
        }
        #twc-nm-overlay .twc-nm-submit:where(:not(.twc-nm-themed)) {
            padding: 12px 16px;
            font-size: 14px;
            font-weight: 600;
            font-family: inherit;
            color: #fff;
            background: #111827;
            border: none;
            border-radius: var(--twc-nm-radius, 8px);
            transition: background 150ms ease;
        }
        #twc-nm-overlay .twc-nm-submit:where(:not(.twc-nm-themed)):hover {
            background: #374151;
        }
        #twc-nm-overlay .twc-nm-submit:disabled {
            opacity: 0.6;
            cursor: default;
        }
        #twc-nm-overlay .twc-nm-disclaimer {
            margin: 0;
        }
        #twc-nm-overlay .twc-nm-disclaimer:where(:not(.twc-nm-themed)) {
            font-size: 12px;
            line-height: 1.5;
            color: var(--twc-nm-muted, #6b7280);
        }
        #twc-nm-overlay .twc-nm-summary {
            display: flex;
            align-items: flex-start;
        }
        #twc-nm-overlay .twc-nm-summary:where(:not(.twc-nm-themed)) {
            gap: 16px;
        }
        /* Theme classes often set display; hidden parts must stay hidden. */
        #twc-nm-overlay .twc-nm-summary [hidden] {
            display: none !important;
        }
        #twc-nm-overlay .twc-nm-summary-image {
            flex: none;
        }
        #twc-nm-overlay .twc-nm-summary-image:where(:not(.twc-nm-themed)) {
            width: 96px;
        }
        #twc-nm-overlay .twc-nm-summary-image img {
            display: block;
            width: 100%;
            height: auto;
        }
        #twc-nm-overlay .twc-nm-summary-info {
            flex: 1 1 auto;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        #twc-nm-overlay .twc-nm-summary-info p {
            margin: 0;
        }
        #twc-nm-overlay .twc-nm-summary-name {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }
        #twc-nm-overlay .twc-nm-summary-name:where(:not(.twc-nm-themed)) {
            font-size: 14px;
            font-weight: 600;
        }
        #twc-nm-overlay .twc-nm-summary-variant:where(:not(.twc-nm-themed)) {
            font-size: 13px;
            color: var(--twc-nm-muted, #6b7280);
        }
        #twc-nm-overlay .twc-nm-summary-price:where(:not(.twc-nm-themed)) {
            font-size: 14px;
        }
        #twc-nm-overlay .twc-nm-summary-compare:where(:not(.twc-nm-themed)) {
            margin-left: 6px;
            color: #9ca3af;
        }
        #twc-nm-overlay .twc-nm-recs {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid var(--twc-nm-border, #e5e7eb);
        }
        #twc-nm-overlay .twc-nm-recs-title {
            margin: 0 0 12px;
            font-size: 14px;
            font-weight: 600;
            color: #111827;
        }
        #twc-nm-overlay .twc-nm-recs-row {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 8px;
            scrollbar-width: thin;
        }
        /* Only where a real pointer exists — the affordance is meaningless
           on touch, which pans the row natively. */
        @media (hover: hover) {
            #twc-nm-overlay .twc-nm-recs-row {
                cursor: grab;
            }
        }
        #twc-nm-overlay .twc-nm-recs-row--dragging,
        #twc-nm-overlay .twc-nm-recs-row--dragging .twc-nm-rec {
            cursor: grabbing;
        }
        #twc-nm-overlay .twc-nm-recs-row--dragging {
            /* Snapping fights a manually driven scrollLeft and feels sticky. */
            scroll-snap-type: none;
            user-select: none;
            -webkit-user-select: none;
        }
        #twc-nm-overlay .twc-nm-rec {
            flex: 0 0 132px;
            scroll-snap-align: start;
            display: flex;
            flex-direction: column;
            gap: 6px;
            color: inherit;
            text-decoration: none;
        }
        #twc-nm-overlay .twc-nm-rec:focus-visible {
            outline: 2px solid #111827;
            outline-offset: 2px;
            border-radius: 8px;
        }
        #twc-nm-overlay .twc-nm-rec-imgbox {
            aspect-ratio: 3 / 4;
            overflow: hidden;
            border-radius: 8px;
            background: #f3f4f6;
        }
        #twc-nm-overlay .twc-nm-rec-img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: opacity 150ms ease;
        }
        #twc-nm-overlay .twc-nm-rec:hover .twc-nm-rec-img {
            opacity: 0.85;
        }
        #twc-nm-overlay .twc-nm-rec-name {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 13px;
            line-height: 1.35;
            color: #111827;
        }
        #twc-nm-overlay .twc-nm-rec-price {
            font-size: 13px;
            font-weight: 600;
            color: #111827;
        }
        #twc-nm-overlay .twc-nm-rec-was {
            margin-right: 4px;
            font-weight: 400;
            color: #9ca3af;
        }
        #twc-nm-overlay .twc-nm-rec--skeleton {
            pointer-events: none;
        }
        #twc-nm-overlay .twc-nm-skel {
            background-color: #f3f4f6;
            background-image: linear-gradient(
                90deg,
                #f3f4f6 0%,
                #e8eaee 50%,
                #f3f4f6 100%
            );
            background-size: 200% 100%;
            border-radius: 4px;
            animation: twc-nm-shimmer 1.3s ease-in-out infinite;
        }
        #twc-nm-overlay .twc-nm-rec-imgbox.twc-nm-skel {
            border-radius: 8px;
        }
        #twc-nm-overlay .twc-nm-skel-line {
            height: 12px;
            width: 100%;
        }
        #twc-nm-overlay .twc-nm-skel-line--short {
            width: 45%;
        }
        @keyframes twc-nm-shimmer {
            from {
                background-position: 200% 0;
            }
            to {
                background-position: -200% 0;
            }
        }
        @media (prefers-reduced-motion: reduce) {
            #twc-nm-overlay,
            #twc-nm-overlay .twc-nm-card,
            #twc-nm-overlay .twc-nm-rec-img {
                transition: none;
            }
            #twc-nm-overlay .twc-nm-card,
            #twc-nm-overlay.twc-nm--panel .twc-nm-card {
                transform: none;
            }
            #twc-nm-overlay .twc-nm-skel {
                animation: none;
            }
        }
    `;

// Inject the widget styles once. All rules are namespaced under #twc-nm-overlay
// (plus .notification-btn) so they don't collide with the host store theme.
export function injectStyles(): void {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = STYLES;
  document.head.appendChild(styleSheet);
}
