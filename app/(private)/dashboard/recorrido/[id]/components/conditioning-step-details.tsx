import type { ReactNode } from 'react';
import { useId } from 'react';
import { ArrowRight, Camera, Users } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CONDITIONING_TEXTS, formatSnapshotDate } from '@/app/(private)/dashboard/components';
import type {
  ConditioningBatchSnapshotLine,
  ExecutionTraceTeamMember,
  TracePerson,
} from '@/lib/modules/asignaciones';
import { avatarTone } from '@/lib/shared/ui/avatar-tone';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { getInitials } from '@/lib/shared/ui/initials';

export const MISSING_DATA_LABEL = 'Sin dato';

const META_ROW_CLASS = 'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground';
const SECTION_LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-widest text-muted-foreground';

function MissingMark() {
  return (
    <span aria-label={MISSING_DATA_LABEL} className="text-muted-foreground">
      {EMPTY_MARK}
    </span>
  );
}

function TeamMemberRow({ member }: { readonly member: ExecutionTraceTeamMember }) {
  return (
    <li
      data-testid="execution-trace-team-member"
      className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b py-1 last:border-b-0"
    >
      {member.displayName === null ? (
        <MissingMark />
      ) : (
        <span className="inline-flex min-h-8 items-center gap-2.5 text-[13px] text-foreground">
          <Avatar size="sm" tone={avatarTone(member.userId)} aria-hidden="true">
            <AvatarFallback>{getInitials(member.displayName)}</AvatarFallback>
          </Avatar>
          {member.displayName}
        </span>
      )}
      {member.origin.kind === 'workGroup' ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="execution-trace-team-group">
          <Users aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{CONDITIONING_TEXTS.workGroupPrefix} </span>
          {member.origin.workGroupName}
        </span>
      ) : null}
    </li>
  );
}

export type ConditioningStartBodyProps = {
  /** Quien firma la anotación, ya pintado por la línea de tiempo. */
  readonly supervisor: ReactNode;
  readonly team: readonly ExecutionTraceTeamMember[];
};

export function ConditioningStartBody({ supervisor, team }: ConditioningStartBodyProps) {
  const teamLabelId = useId();
  return (
    <div className="flex flex-col gap-1.5" data-testid="execution-trace-conditioning-start">
      <div className={META_ROW_CLASS} data-testid="execution-trace-supervisor">
        <span>{CONDITIONING_TEXTS.supervisor}</span>
        {supervisor}
      </div>
      <div className="flex flex-col gap-1.5">
        <span id={teamLabelId} className={SECTION_LABEL_CLASS} data-testid="execution-trace-team-count">
          {CONDITIONING_TEXTS.teamPrefix}
          {team.length}
        </span>
        {team.length === 0 ? (
          <p className="m-0 text-xs text-muted-foreground" data-testid="execution-trace-no-team">
            {CONDITIONING_TEXTS.noTeam}
          </p>
        ) : (
          <ul
            aria-labelledby={teamLabelId}
            className="m-0 flex list-none flex-col rounded-lg border bg-card px-3 py-0.5"
            data-testid="execution-trace-team"
          >
            {team.map((member) => (
              <TeamMemberRow key={member.userId} member={member} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PresentationName({ name }: { readonly name: string | null }) {
  return name === null ? <MissingMark /> : <span>{name}</span>;
}

export type ConditioningBatchLinesTableProps = {
  readonly lines: readonly ConditioningBatchSnapshotLine[];
};

/** Tabla en contenedores anchos y una tarjeta por línea en los estrechos, con el corte de `DataTable`. */
export function ConditioningBatchLinesTable({ lines }: ConditioningBatchLinesTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="@max-[760px]:hidden" data-testid="execution-trace-batch-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="h-9 px-3">
                {CONDITIONING_TEXTS.lot}
              </TableHead>
              <TableHead scope="col" className="h-9 px-3">
                {CONDITIONING_TEXTS.presentation}
              </TableHead>
              <TableHead scope="col" className="h-9 px-3 text-right">
                {CONDITIONING_TEXTS.expiry}
              </TableHead>
              <TableHead scope="col" className="h-9 px-3 text-right">
                {CONDITIONING_TEXTS.productionDay}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, index) => (
              <TableRow key={`${line.batchId}-${index}`} data-testid="execution-trace-batch-line">
                <TableCell className="h-11 px-3 font-mono font-semibold">{line.lot}</TableCell>
                <TableCell className="h-11 px-3">
                  <PresentationName name={line.presentationName} />
                </TableCell>
                <TableCell className="h-11 px-3 text-right font-mono">{formatSnapshotDate(line.expiryDate)}</TableCell>
                <TableCell className="h-11 px-3 text-right font-mono">
                  {formatSnapshotDate(line.productionDate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="m-0 hidden list-none flex-col p-0 @max-[760px]:flex" data-testid="execution-trace-batch-cards">
        {lines.map((line, index) => (
          <li
            key={`${line.batchId}-${index}`}
            className="flex flex-col gap-1 border-b px-3 py-2.5 last:border-b-0"
            data-testid="execution-trace-batch-card"
          >
            <div className="flex items-center justify-between gap-2.5 text-sm">
              <span className="font-mono font-semibold">{line.lot}</span>
              <PresentationName name={line.presentationName} />
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-muted-foreground">
              <span>
                {CONDITIONING_TEXTS.expiresPrefix}{' '}
                <span className="font-mono text-foreground">{formatSnapshotDate(line.expiryDate)}</span>
              </span>
              <span>
                {CONDITIONING_TEXTS.producedPrefix}{' '}
                <span className="font-mono text-foreground">{formatSnapshotDate(line.productionDate)}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type ConditioningBatchSaveBodyProps = {
  /** Quien guardó, ya pintado por la línea de tiempo. */
  readonly savedBy: ReactNode;
  readonly lines: readonly ConditioningBatchSnapshotLine[];
};

export function ConditioningBatchSaveBody({ savedBy, lines }: ConditioningBatchSaveBodyProps) {
  const countLabel = lines.length === 1 ? CONDITIONING_TEXTS.presentationOne : CONDITIONING_TEXTS.presentationMany;
  return (
    <div className="flex flex-col gap-1.5" data-testid="execution-trace-batch-save">
      <div className={META_ROW_CLASS}>
        <span>{CONDITIONING_TEXTS.savedBy}</span>
        {savedBy}
        <span data-testid="execution-trace-batch-count">
          {lines.length} {countLabel}
        </span>
      </div>
      <ConditioningBatchLinesTable lines={lines} />
      <p className="m-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="execution-trace-batch-notice">
        <Camera aria-hidden="true" className="size-3.5" />
        {CONDITIONING_TEXTS.snapshotNotice}
      </p>
    </div>
  );
}

function ResponsibleChip({ person }: { readonly person: TracePerson }) {
  if (person.displayName === null) return <MissingMark />;
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 text-[13px] text-foreground">
      <Avatar size="sm" tone={avatarTone(person.userId)} aria-hidden="true">
        <AvatarFallback>{getInitials(person.displayName)}</AvatarFallback>
      </Avatar>
      {person.displayName}
    </span>
  );
}

export type ConditioningStepBodyProps = {
  /** «Paso N» y quien lo completó, ya pintados por la línea de tiempo. */
  readonly meta: ReactNode;
  /** Vacío si el paso no pide asignación: entonces no hay línea «Responsables». */
  readonly responsibles: readonly TracePerson[];
  /** Fotos de evidencia del paso; `0` no pinta la cifra. */
  readonly photoCount: number;
};

/** Cuerpo de «Avanzar» y «Completar pasos» de acondicionamiento. */
export function ConditioningStepBody({ meta, responsibles, photoCount }: ConditioningStepBodyProps) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1.5" data-testid="execution-trace-conditioning-step">
      {meta}
      {responsibles.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-2" data-testid="execution-trace-responsibles">
          <span id={labelId} className={SECTION_LABEL_CLASS}>
            {CONDITIONING_TEXTS.responsibles}
          </span>
          <ul aria-labelledby={labelId} className="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0">
            {responsibles.map((person) => (
              <li key={person.userId} data-testid="execution-trace-responsible">
                <ResponsibleChip person={person} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {photoCount > 0 ? (
        <p className="m-0 text-xs text-muted-foreground" data-testid="execution-trace-step-photo-count">
          {CONDITIONING_TEXTS.evidencePhotos(photoCount)}
        </p>
      ) : null}
    </div>
  );
}

function PeopleNames({ people }: { readonly people: readonly TracePerson[] }) {
  if (people.length === 0) return <MissingMark />;
  return (
    <>
      {people.map((person, index) => (
        <span key={person.userId}>
          {index > 0 ? ', ' : null}
          {person.displayName === null ? <MissingMark /> : person.displayName}
        </span>
      ))}
    </>
  );
}

export type ConditioningResponsiblesChangeBodyProps = {
  /** «Paso N» y quien hizo el cambio, ya pintados por la línea de tiempo. */
  readonly meta: ReactNode;
  readonly previous: readonly TracePerson[];
  readonly responsibles: readonly TracePerson[];
};

/** «Antes:» tachado → el conjunto nuevo. `del`/`ins` dan a los lectores el sentido del tachado. */
export function ConditioningResponsiblesChangeBody({ meta, previous, responsibles }: ConditioningResponsiblesChangeBodyProps) {
  return (
    <div className="flex flex-col gap-1.5" data-testid="execution-trace-responsibles-change">
      {meta}
      <p className="m-0 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        <span>{CONDITIONING_TEXTS.responsiblesBefore}</span>
        <del className="line-through" data-testid="execution-trace-responsibles-before">
          <PeopleNames people={previous} />
        </del>
        <ArrowRight aria-hidden="true" className="size-3.5" />
        <ins className="text-foreground no-underline" data-testid="execution-trace-responsibles-after">
          <PeopleNames people={responsibles} />
        </ins>
      </p>
    </div>
  );
}
