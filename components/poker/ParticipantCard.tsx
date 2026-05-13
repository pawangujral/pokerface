'use client';

import type { Participant } from '@/types';

interface Props {
  pid: string;
  participant: Participant;
  currentPid: string;
  revealed: boolean;
}

export default function ParticipantCard({ pid, participant, currentPid, revealed }: Props) {
  const isYou = pid === currentPid;
  const hasVoted = participant.vote !== null;

  let badgeClass = 'vote-badge ';
  let badgeText = '–';

  if (revealed && hasVoted) {
    badgeClass += 'revealed';
    badgeText = participant.vote!;
  } else if (hasVoted) {
    badgeClass += 'voted';
    badgeText = '✓';
  } else {
    badgeClass += 'not-voted';
  }

  return (
    <li>
      <span className={`participant-name${isYou ? ' is-you' : ''}`}>
        {participant.name}
        {participant.spectator && ' 👁'}
        {isYou && ' (you)'}
      </span>
      {!participant.spectator && (
        <span className={badgeClass}>{badgeText}</span>
      )}
    </li>
  );
}
