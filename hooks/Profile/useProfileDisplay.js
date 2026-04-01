export const useProfileDisplay = ({ firstName, lastName, username }) => {
  const fullName =
    firstName && lastName ? `${firstName} ${lastName}` : (username ?? "");

  const initials = (
    firstName && lastName
      ? `${firstName[0]}${lastName[0]}`
      : username.slice(0, 2)
  ).toUpperCase();

  return { fullName, initials };
};
