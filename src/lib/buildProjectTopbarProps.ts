import type { ProjectTopbarProps } from '../components/ProjectTopbar';
import { getAccessProfile } from '../data/workspaceBase';
import type { AuthSession, CompanyProfile, UserItem } from '../types';

interface BuildProjectTopbarPropsArgs {
  users: UserItem[];
  authSession: AuthSession | null;
  serverMode: 'checking' | 'connected' | 'syncing' | 'offline' | 'error' | 'auth_required';
  serverAuthRequired: boolean;
  publicTenantName: string;
  activeUserId: string;
  activeAccessProfileLabel: string;
  companyProfile: CompanyProfile;
  selectedModuleId: string;
  moduleOptions: Array<{ id: string; name: string }>;
  onSelectActiveUser: ProjectTopbarProps['onSelectActiveUser'];
  onSyncNow: ProjectTopbarProps['onSyncNow'];
  onExportJson: ProjectTopbarProps['onExportJson'];
  onProfileFieldChange: ProjectTopbarProps['onProfileFieldChange'];
  onSelectModule: ProjectTopbarProps['onSelectModule'];
  canExportJson: boolean;
}

export function buildProjectTopbarProps({
  users,
  authSession,
  serverMode,
  serverAuthRequired,
  publicTenantName,
  activeUserId,
  activeAccessProfileLabel,
  companyProfile,
  selectedModuleId,
  moduleOptions,
  onSelectActiveUser,
  onSyncNow,
  onExportJson,
  onProfileFieldChange,
  onSelectModule,
  canExportJson,
}: BuildProjectTopbarPropsArgs): ProjectTopbarProps {
  const userOptions = users.map((user) => ({
    id: user.id,
    label: `${user.name || 'Ohne Namen'} · ${getAccessProfile(user.roleProfile).label}`,
  }));

  const serverStatusConnected = serverMode === 'connected' || serverMode === 'syncing';
  const serverStatusLabel = serverMode === 'connected'
    ? authSession
      ? 'Server verbunden'
      : 'Offener Arbeitsbereich aktiv'
    : serverMode === 'syncing'
      ? 'Server synchronisiert'
      : serverMode === 'checking'
        ? 'Server wird geprüft'
        : serverMode === 'auth_required'
          ? 'Anmeldung erforderlich'
          : serverMode === 'error'
            ? 'Serverfehler'
            : 'Nur lokaler Modus';

  const tenantChipLabel = !authSession && !serverAuthRequired && publicTenantName
    ? `Arbeitsbereich: ${publicTenantName}`
    : authSession
      ? `Mandant: ${authSession.tenantName}`
      : '';
  const accountChipLabel = authSession ? `Konto: ${authSession.email}` : '';
  const canSync = !(serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required');

  return {
    activeUserId,
    userOptions,
    authSession,
    serverStatusConnected,
    serverStatusLabel,
    activeAccessProfileLabel,
    tenantChipLabel,
    accountChipLabel,
    canSync,
    canExportJson,
    companyProfile,
    selectedModuleId,
    moduleOptions,
    onSelectActiveUser,
    onSyncNow,
    onExportJson,
    onProfileFieldChange,
    onSelectModule,
  };
}
