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
            background: rgba(17, 17, 17, 0.55);
            opacity: 0;
            visibility: hidden;
            transition: opacity 200ms ease;
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
            padding: 24px;
            background: #fff;
            color: #111827;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
            font: inherit;
            transform: translateY(8px);
            transition: transform 200ms ease;
        }
        #twc-nm-overlay.is-open .twc-nm-card {
            transform: translateY(0);
        }
        #twc-nm-overlay .twc-nm-close {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            border: none;
            background: transparent;
            border-radius: 6px;
            font-size: 24px;
            line-height: 1;
            color: #6b7280;
            cursor: pointer;
        }
        #twc-nm-overlay .twc-nm-close:hover {
            background: #f3f4f6;
            color: #111827;
        }
        #twc-nm-overlay .twc-nm-title {
            margin: 0 32px 4px 0;
            font-size: 18px;
            font-weight: 600;
        }
        #twc-nm-overlay .twc-nm-text {
            margin: 0 0 16px;
            font-size: 14px;
            line-height: 1.5;
            color: #6b7280;
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
        #twc-nm-overlay .twc-nm-label {
            font-size: 13px;
            font-weight: 500;
            color: #374151;
        }
        #twc-nm-overlay .twc-nm-input,
        #twc-nm-overlay .twc-nm-select {
            width: 100%;
            padding: 10px 12px;
            font-size: 14px;
            font-family: inherit;
            color: #111827;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
        }
        #twc-nm-overlay .twc-nm-input:focus,
        #twc-nm-overlay .twc-nm-select:focus {
            outline: none;
            border-color: #111827;
            box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
        }
        #twc-nm-overlay .twc-nm-select {
            appearance: none;
            -webkit-appearance: none;
            padding-right: 36px;
            cursor: pointer;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
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
            accent-color: #111827;
        }
        #twc-nm-overlay .twc-nm-status {
            font-size: 13px;
            line-height: 1.5;
            padding: 10px 12px;
            border-radius: 8px;
        }
        #twc-nm-overlay .twc-nm-status--error {
            color: #b91c1c;
            background: #fef2f2;
        }
        #twc-nm-overlay .twc-nm-status--success {
            color: #15803d;
            background: #f0fdf4;
        }
        #twc-nm-overlay .twc-nm-submit {
            width: 100%;
            padding: 12px 16px;
            font-size: 14px;
            font-weight: 600;
            font-family: inherit;
            color: #fff;
            background: #111827;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: background 150ms ease;
        }
        #twc-nm-overlay .twc-nm-submit:hover {
            background: #374151;
        }
        #twc-nm-overlay .twc-nm-submit:disabled {
            opacity: 0.6;
            cursor: default;
        }
        #twc-nm-overlay .twc-nm-recs {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
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
            #twc-nm-overlay .twc-nm-card {
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
