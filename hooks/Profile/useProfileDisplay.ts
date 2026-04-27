
export const useProfileDisplay = ({ firstName, lastName, username }: { firstName?: string; lastName?: string; username?: string }) => {
  const fullName =
    firstName && lastName ? `${firstName} ${lastName}` : (username ?? "");

  const initials = (
    firstName && lastName
      ? `${firstName[0]}${lastName[0]}`
      : (username ?? "").slice(0, 2)
  ) 
    .toUpperCase();

  const shortName =
    firstName && lastName ? `${firstName} ${lastName[0]}.` : (username ?? "");

  return { fullName, initials, shortName };
};
