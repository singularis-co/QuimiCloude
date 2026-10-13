import { ResponsibleAvatars } from '@/components/shared/responsible-avatars';
import type { ConditioningTeamMemberView } from '@/lib/modules/asignaciones';
import { groupResponsiblesByOrigin } from '@/lib/shared/ui/responsible-groups';

export const CONDITIONING_TEAM_LIST_TESTID = 'conditioning-team-list';
export const CONDITIONING_TEAM_LIST_GROUP_TESTID = 'conditioning-team-list-group';
export const CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID = 'conditioning-team-list-group-name';
export const CONDITIONING_TEAM_LIST_MEMBER_TESTID = 'conditioning-team-list-member';

export const CONDITIONING_TEAM_LIST_TEXTS = {
  title: 'Equipo',
  directLabel: 'Personas sueltas',
} as const;

export type ConditioningTeamListProps = {
  readonly team: readonly ConditioningTeamMemberView[];
};

export function ConditioningTeamList({ team }: ConditioningTeamListProps) {
  const groups = groupResponsiblesByOrigin(team);

  return (
    <section
      aria-labelledby="conditioning-team-heading"
      className="flex flex-col gap-3"
      data-testid={CONDITIONING_TEAM_LIST_TESTID}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="conditioning-team-heading" className="text-base font-medium">
          {CONDITIONING_TEAM_LIST_TEXTS.title}
        </h2>
        <ResponsibleAvatars
          responsibles={team.map((member) => ({ userId: member.userId, displayName: member.displayName }))}
        />
      </div>
      <ul className="flex flex-col gap-3">
        {groups.map((group) => (
          <li
            key={group.kind === 'direct' ? 'direct' : group.workGroupId}
            className="flex flex-col gap-1"
            data-testid={CONDITIONING_TEAM_LIST_GROUP_TESTID}
            data-kind={group.kind}
          >
            <span className="text-sm font-medium" data-testid={CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID}>
              {group.kind === 'direct' ? CONDITIONING_TEAM_LIST_TEXTS.directLabel : group.workGroupName}
            </span>
            <ul className="flex flex-col gap-1">
              {group.responsibles.map((member) => (
                <li
                  key={member.userId}
                  className="text-base"
                  data-testid={CONDITIONING_TEAM_LIST_MEMBER_TESTID}
                  data-user-id={member.userId}
                >
                  {member.displayName}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
