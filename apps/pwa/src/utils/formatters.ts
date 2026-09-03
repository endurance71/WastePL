export function getFractionLabel(fraction: string): string {
  switch (fraction.toUpperCase()) {
    case 'BIO':
      return 'Bioodpady';
    case 'METALS_PLASTICS':
      return 'Metale i tworzywa sztuczne';
    case 'PAPER':
      return 'Papier';
    case 'GLASS':
      return 'Szkło';
    case 'RESIDUAL':
      return 'Zmieszane (resztkowe)';
    case 'BULKY':
      return 'Wielkogabarytowe';
    case 'ELECTRONICS':
      return 'Elektrośmieci';
    case 'GREEN':
      return 'Odpady zielone';
    case 'TYRES':
      return 'Zużyte opony';
    case 'HAZARDOUS':
      return 'Niebezpieczne';
    case 'CONSTRUCTION':
      return 'Budowlane / rozbiórkowe';
    default:
      return fraction;
  }
}

export function getFractionClass(fraction: string): string {
  switch (fraction.toUpperCase()) {
    case 'BIO':
      return 'bio';
    case 'METALS_PLASTICS':
      return 'metals_plastics';
    case 'PAPER':
      return 'paper';
    case 'GLASS':
      return 'glass';
    case 'RESIDUAL':
      return 'residual';
    case 'BULKY':
      return 'bulky';
    default:
      return 'other';
  }
}

export function formatDayCountdown(dateStr: string): { relativeText: string; isUrgent: boolean } {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { relativeText: `${Math.abs(diffDays)} dni temu`, isUrgent: false };
  }
  if (diffDays === 0) {
    return { relativeText: 'Dziś', isUrgent: true };
  }
  if (diffDays === 1) {
    return { relativeText: 'Jutro', isUrgent: true };
  }
  if (diffDays === 2) {
    return { relativeText: 'Pojutrze', isUrgent: true };
  }
  if (diffDays <= 7) {
    return { relativeText: `Za ${diffDays} dni`, isUrgent: false };
  }
  return { relativeText: `Za ${diffDays} dni`, isUrgent: false };
}

export function formatPolishDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function getPolishDayName(day: string): string {
  switch (day) {
    case 'MONDAY':
      return 'Poniedziałek';
    case 'TUESDAY':
      return 'Wtorek';
    case 'WEDNESDAY':
      return 'Środa';
    case 'THURSDAY':
      return 'Czwartek';
    case 'FRIDAY':
      return 'Piątek';
    case 'SATURDAY':
      return 'Sobota';
    case 'SUNDAY':
      return 'Niedziela';
    default:
      return day;
  }
}
