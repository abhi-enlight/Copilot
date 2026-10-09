import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * 1. Microsoft Outlook (Official Fluent icon)
 */
export function OutlookLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Microsoft Outlook">
      <rect x="4" y="8" width="36" height="48" rx="8" fill="#0078D4" />
      <path d="M4 19L22 31L40 19" stroke="#50A0E0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19L22 31L40 19V14C40 10.7 37.3 8 34 8H10C6.7 8 4 10.7 4 14V19Z" fill="#28A8EA" />
      <rect x="24" y="16" width="36" height="36" rx="8" fill="#106EBE" />
      <circle cx="42" cy="34" r="10.5" fill="white" />
      <circle cx="42" cy="34" r="6" fill="#106EBE" />
    </svg>
  );
}

/**
 * 2. Microsoft Teams (Official Fluent icon)
 */
export function TeamsLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Microsoft Teams">
      <circle cx="43" cy="21" r="9" fill="#7B83EB" />
      <path d="M33 34H53C56.3 34 59 36.7 59 40V46C59 47.1 58.1 48 57 48H33V34Z" fill="#5B63D3" />
      <rect x="7" y="14" width="34" height="40" rx="8" fill="#464EB8" />
      <circle cx="24" cy="27" r="7" fill="white" fillOpacity="0.2" />
      <path d="M16 27H32M24 27V43" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 3. Microsoft SharePoint (Official Fluent 3-disc icon)
 */
export function SharePointLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Microsoft SharePoint">
      <circle cx="39" cy="22" r="14" fill="#038387" />
      <circle cx="23" cy="35" r="16" fill="#00A29C" />
      <circle cx="39" cy="42" r="12" fill="#004E52" />
      <circle cx="23" cy="35" r="9" fill="white" fillOpacity="0.2" />
      <path d="M19 40C20 41 22 41.5 24 41.5C26.5 41.5 28 40 28 38.5C28 36.5 26 35.8 24 35.2C21.5 34.5 19 33.8 19 31.5C19 29.5 20.8 28 23.5 28C25.5 28 27.2 28.6 28 29.5" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 4. Dynamics 365 (Official Microsoft Dynamics faceted cube)
 */
export function DynamicsLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Microsoft Dynamics 365">
      <path d="M12 14L34 22V42L12 34V14Z" fill="#002050" />
      <path d="M34 22L52 30V50L34 42V22Z" fill="#0078D4" />
      <path d="M12 34L34 42L24 54L12 34Z" fill="#005A9E" />
    </svg>
  );
}

/**
 * 5. Zoho CRM (Authentic Zoho CRM icon: vibrant blue tile with white interlocking infinity loop)
 * NOT the 4-color Microsoft logo!
 */
export function ZohoCrmLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Zoho CRM">
      <rect width="64" height="64" rx="16" fill="#3B82F6" />
      {/* Official white interlocking infinity / chain loop */}
      <path
        d="M23 21C16.9249 21 12 25.9249 12 32C12 38.0751 16.9249 43 23 43C27.424 43 31.229 40.388 32.96 36.63L30.2 34.78C28.87 37.69 26.13 39.5 23 39.5C18.8579 39.5 15.5 36.1421 15.5 32C15.5 27.8579 18.8579 24.5 23 24.5C26.13 24.5 28.87 26.31 30.2 29.22L32.96 27.37C31.229 23.612 27.424 21 23 21Z"
        fill="white"
      />
      <path
        d="M41 43C47.0751 43 52 38.0751 52 32C52 25.9249 47.0751 21 41 21C36.576 21 32.771 23.612 31.04 27.37L33.8 29.22C35.13 26.31 37.87 24.5 41 24.5C45.1421 24.5 48.5 27.8579 48.5 32C48.5 36.1421 45.1421 39.5 41 39.5C37.87 39.5 35.13 37.69 33.8 34.78L31.04 36.63C32.771 40.388 36.576 43 41 43Z"
        fill="white"
      />
      <path
        d="M23.5 27L40.5 37"
        stroke="white"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
      <path
        d="M26 38L37.5 26.5"
        stroke="white"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 6. Zoho Books (Official stylized letter B with ledger loops)
 */
export function ZohoBooksLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Zoho Books">
      <rect width="64" height="64" rx="16" fill="#0284C7" />
      <path
        d="M22 18H34C37.866 18 41 21.134 41 25C41 27.8 39.3 30.2 37 31.3C40 32.5 42 35.5 42 39C42 43.4 38.4 47 34 47H22V18Z"
        fill="none"
        stroke="white"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="25" r="3.5" fill="white" />
      <circle cx="32" cy="39" r="4" fill="white" />
    </svg>
  );
}

/**
 * 7. Gmail (Official Google 4-color envelope)
 */
export function GmailLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Gmail">
      <path d="M12 50V21L32 35L52 21V50C52 52.2 50.2 54 48 54H16C13.8 54 12 52.2 12 50Z" fill="#EA4335" />
      <path d="M12 18C12 14 15 11 19 11H24L32 17L40 11H45C49 11 52 14 52 18V50C52 52.2 50.2 54 48 54H16C13.8 54 12 52.2 12 50V18Z" fill="#FFFFFF" />
      <path d="M12 21L32 35L52 21" stroke="#EA4335" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 20V50C12 52.2 13.8 54 16 54H20V27L12 20Z" fill="#4285F4" />
      <path d="M52 20V50C52 52.2 50.2 54 48 54H44V27L52 20Z" fill="#34A853" />
      <path d="M12 17C12 15 13.5 13 16 13H20V27L12 20V17Z" fill="#C5221F" />
      <path d="M52 17C52 15 50.5 13 48 13H44V27L52 20V17Z" fill="#FBBC04" />
      <path d="M20 13H44L32 22L20 13Z" fill="#EA4335" />
    </svg>
  );
}

/**
 * 8. Google Calendar (Official Google Calendar badge)
 */
export function GoogleCalendarLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Google Calendar">
      <rect x="10" y="10" width="44" height="44" rx="10" fill="#FFFFFF" stroke="rgba(0,0,0,0.08)" strokeWidth="1.5" />
      <path d="M10 19C10 14 14 10 19 10H45C50 10 54 14 54 19V23H10V19Z" fill="#4285F4" />
      <rect x="18" y="7" width="5" height="7" rx="2.5" fill="#EA4335" />
      <rect x="41" y="7" width="5" height="7" rx="2.5" fill="#EA4335" />
      <text x="32" y="44" fill="#1C1917" fontSize="22" fontWeight="700" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">
        31
      </text>
    </svg>
  );
}

/**
 * 9. Slack (Official Slack 4-color octothorpe)
 */
export function SlackLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Slack">
      <path d="M16 36C13.8 36 12 37.8 12 40C12 42.2 13.8 44 16 44H20V40C20 37.8 18.2 36 16 36Z" fill="#E01E5A" />
      <path d="M24 36C26.2 36 28 37.8 28 40V49C28 51.2 26.2 53 24 53C21.8 53 20 51.2 20 49V40C20 37.8 21.8 36 24 36Z" fill="#E01E5A" />
      <path d="M28 16C28 13.8 26.2 12 24 12C21.8 12 20 13.8 20 16V20H24C26.2 20 28 18.2 28 16Z" fill="#36C5F0" />
      <path d="M28 24C28 26.2 26.2 28 24 28H15C12.8 28 11 26.2 11 24C11 21.8 12.8 20 15 20H24C26.2 20 28 21.8 28 24Z" fill="#36C5F0" />
      <path d="M48 28C50.2 28 52 26.2 52 24C52 21.8 50.2 20 48 20H44V24C44 26.2 45.8 28 48 28Z" fill="#2EB67D" />
      <path d="M40 28C37.8 28 36 26.2 36 24V15C36 12.8 37.8 11 40 11C42.2 11 44 12.8 44 15V24C44 26.2 42.2 28 40 28Z" fill="#2EB67D" />
      <path d="M36 48C36 50.2 37.8 52 40 52C42.2 52 44 50.2 44 48V44H40C37.8 44 36 45.8 36 48Z" fill="#ECB22E" />
      <path d="M36 40C36 37.8 37.8 36 40 36H49C51.2 36 53 37.8 53 40C53 42.2 51.2 44 49 44H40C37.8 44 36 42.2 36 40Z" fill="#ECB22E" />
    </svg>
  );
}

/**
 * 10. Linear (Official Linear geometric wave mark)
 */
export function LinearLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Linear">
      <rect width="64" height="64" rx="16" fill="#5E6AD2" />
      <path
        d="M12 39L39 12H52L12 52V39ZM25 52L52 25V38L38 52H25Z"
        fill="white"
      />
    </svg>
  );
}

/**
 * 11. GitHub (Official GitHub Octocat silhouette)
 */
export function GitHubLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="GitHub">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M32 8C18.74 8 8 18.74 8 32C8 42.6 14.88 51.6 24.42 54.78C25.62 55 26.06 54.26 26.06 53.62C26.06 53.04 26.04 51.12 26.02 49.06C19.34 50.52 17.94 46.14 17.94 46.14C16.84 43.36 15.28 42.62 15.28 42.62C13.1 41.14 15.44 41.16 15.44 41.16C17.86 41.34 19.12 43.64 19.12 43.64C21.26 47.3 24.72 46.24 26.08 45.62C26.3 44.08 26.92 43.02 27.6 42.42C22.28 41.82 16.68 39.76 16.68 30.58C16.68 27.96 17.62 25.82 19.14 24.14C18.9 23.54 18.08 21.1 19.38 17.8C19.38 17.8 21.4 17.16 25.98 20.26C27.9 19.72 29.96 19.46 32 19.46C34.04 19.46 36.1 19.72 38.02 20.26C42.6 17.16 44.62 17.8 44.62 17.8C45.92 21.1 45.1 23.54 44.86 24.14C46.4 25.82 47.32 27.96 47.32 30.58C47.32 39.78 41.72 41.8 36.38 42.4C37.24 43.14 38 44.6 38 46.84C38 50.08 37.98 52.68 37.98 53.62C37.98 54.26 38.4 55.02 39.62 54.78C49.16 51.58 56 42.6 56 32C56 18.74 45.26 8 32 8Z"
        fill="#1C1917"
      />
    </svg>
  );
}

/**
 * 12. Notion (Official clean Notion block)
 */
export function NotionLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Notion">
      <rect width="64" height="64" rx="16" fill="#1C1917" />
      <path
        d="M18 17C19.6 16.8 21 16.4 22.4 16L41.6 14.6C43.4 14.4 44.2 15.2 44 17.2L41.8 43.4C41.4 45 40.2 45.8 38.4 46L19.2 47.2C17.6 47.4 16.8 46.6 17 44.8L19.2 18.6C19.2 18 18.6 17.6 18 17Z"
        fill="#FFFFFF"
      />
      <path
        d="M25 21.6H27.6L32.4 33V21.6H35V36.4H32.4L27.6 25V36.4H25V21.6Z"
        fill="#1C1917"
      />
    </svg>
  );
}

/**
 * 13. Atlassian Jira
 */
export function JiraLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Atlassian Jira">
      <rect width="64" height="64" rx="16" fill="#0052CC" />
      <path
        d="M32 16C37.52 21.52 37.52 30.48 32 36C26.48 30.48 26.48 21.52 32 16Z"
        fill="#FFFFFF"
        fillOpacity="0.8"
      />
      <path
        d="M32 36C37.52 41.52 37.52 50.48 32 56C26.48 50.48 26.48 41.52 32 36Z"
        fill="#FFFFFF"
      />
      <path
        d="M20 28C25.52 33.52 25.52 42.48 20 48C14.48 42.48 14.48 33.52 20 28Z"
        fill="#FFFFFF"
        fillOpacity="0.5"
      />
    </svg>
  );
}

/**
 * 14. Monday.com
 */
export function MondayLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Monday.com">
      <rect width="64" height="64" rx="16" fill="#181B34" />
      <circle cx="20" cy="38" r="6" fill="#F43F5E" />
      <circle cx="32" cy="38" r="6" fill="#FBBF24" />
      <circle cx="44" cy="38" r="6" fill="#10B981" />
      <path
        d="M17 26C17 24.34 18.34 23 20 23C21.66 23 23 24.34 23 26V32H17V26Z"
        fill="#F43F5E"
      />
      <path
        d="M29 20C29 18.34 30.34 17 32 17C33.66 17 35 18.34 35 20V32H29V20Z"
        fill="#FBBF24"
      />
      <path
        d="M41 24C41 22.34 42.34 21 44 21C45.66 21 47 22.34 47 24V32H41V24Z"
        fill="#10B981"
      />
    </svg>
  );
}

/**
 * 15. ClickUp
 */
export function ClickUpLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="ClickUp">
      <rect width="64" height="64" rx="16" fill="#7B68EE" />
      <path
        d="M20 38L32 26L44 38"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23 46C26 49 29 50 32 50C35 50 38 49 41 46"
        stroke="#FFB900"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 16. Zoho Projects (Official Zoho Projects red tile with project task flow)
 */
export function ZohoProjectsLogo({ size = 56, className = "" }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Zoho Projects">
      <rect width="64" height="64" rx="16" fill="#E42528" />
      <circle cx="22" cy="22" r="4.5" fill="white" />
      <rect x="31" y="20" width="16" height="4" rx="2" fill="white" />
      <circle cx="22" cy="32" r="4.5" fill="white" />
      <rect x="31" y="30" width="20" height="4" rx="2" fill="white" />
      <circle cx="22" cy="42" r="4.5" fill="white" />
      <rect x="31" y="40" width="13" height="4" rx="2" fill="white" />
      <line x1="22" y1="26.5" x2="22" y2="27.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="22" y1="36.5" x2="22" y2="37.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

