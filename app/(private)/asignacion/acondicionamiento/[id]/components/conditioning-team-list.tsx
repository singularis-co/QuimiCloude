import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { ConditioningTeamMemberView } from '@/lib/modules/asignaciones';
import { avatarTone } from '@/lib/shared/ui/avatar-tone';
import { getInitials } from '@/lib/shared/ui/initials';
import { groupResponsiblesByOrigin } from '@/lib/shared/ui/responsible-groups';

export const CONDITIONING_TEAM_LIST_TESTID = 'conditioning-team-list';
export const CONDITIONING_TEAM_LIST_GROUP_TESTID = 'conditioning-team-list-group';
export const CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID = 'conditioning-team-list-group-name';
export const CONDITIONING_TEAM_LIST_GROUP_COUNT_TESTID = 'conditioning-team-list-group-count';
export const CONDITIONING_TEAM_LIST_MEMBER_TESTID = 'conditioning-team-list-member';
export const CONDITIONING_TEAM_LIST_ROW_TESTID = 'conditioning-team-list-row';
export const CONDITIONING_TEAM_LIST_ME_TESTID = 'conditioning-team-list-me';

export const CONDITIONING_TEAM_LIST_TEXTS = {
  title: 'Equipo',
  directLabel: 'Personas',
  me: 'Tú',
} as const;

export type ConditioningTeamListProps = {
  readonly team: readonly ConditioningTeamMemberView[];
  /** Usuario de la sesión: su fila lleva la marca «Tú». */
  readonly actorId?: string | null;
};

/** El título y el contador del equipo los pone la tarjeta que envuelve la lista. */
export function ConditioningTeamList({ team, actorId = null }: ConditioningTeamListProps) {
  const groups = groupResponsiblesByOrigin(team);

  return (
    <ul className="flex flex-col gap-3" data-testid={CONDITIONING_TEAM_LIST_TESTID}>
      {groups.map((group) => (
        <li
          key={group.kind === 'direct' ? 'direct' : group.workGroupId}
          className="flex flex-col gap-2 not-first:border-t not-first:pt-3"
          data-testid={CONDITIONING_TEAM_LIST_GROUP_TESTID}
          data-kind={group.kind}
        >
          <div className="flex items-center justify-between gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            <span data-testid={CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID}>
              {group.kind === 'direct' ? CONDITIONING_TEAM_LIST_TEXTS.directLabel : group.workGroupName}
            </span>
            <span className="font-mono tabular-nums" data-testid={CONDITIONING_TEAM_LIST_GROUP_COUNT_TESTID}>
              {group.responsibles.length}
            </span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {group.responsibles.map((member) => (
              <li
                key={member.userId}
                className="flex min-h-11 items-center gap-3 text-base"
                data-testid={CONDITIONING_TEAM_LIST_ROW_TESTID}
              >
                <Avatar aria-hidden="true" className="size-9" tone={avatarTone(member.userId)}>
                  <AvatarFallback className="font-semibold">{getInitials(member.displayName)}</AvatarFallback>
                </Avatar>
                {/* El testid de miembro va en el nombre: su texto sigue siendo solo el nombre. */}
                <span
                  className="min-w-0 break-words"
                  data-testid={CONDITIONING_TEAM_LIST_MEMBER_TESTID}
                  data-user-id={member.userId}
                >
                  {member.displayName}
                </span>
                {actorId !== null && member.userId === actorId ? (
                  <span
                    className="ml-auto shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                    data-testid={CONDITIONING_TEAM_LIST_ME_TESTID}
                  >
                    {CONDITIONING_TEAM_LIST_TEXTS.me}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
