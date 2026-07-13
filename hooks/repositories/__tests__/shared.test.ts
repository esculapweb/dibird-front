jest.mock("../referenceRepository", () => ({
  getCachedCountries: jest.fn(),
}));

import { getCachedCountries } from "../referenceRepository";
import { territoryDataFor, ownerFromProfile } from "../shared";

const mockGetCachedCountries = getCachedCountries as jest.Mock;

describe("territoryDataFor", () => {
  afterEach(() => {
    mockGetCachedCountries.mockReset();
  });

  it.each([undefined, null, 0])(
    "short-circuits without calling getCachedCountries for %p",
    (territory) => {
      expect(territoryDataFor(territory)).toEqual({
        code: "",
        id: 0,
        name: "",
        segment: "",
      });
      expect(mockGetCachedCountries).not.toHaveBeenCalled();
    },
  );

  it("returns the matching country's code/name when found", () => {
    mockGetCachedCountries.mockReturnValue([
      { value: 5, label: "France", code: "FR" },
    ]);
    expect(territoryDataFor(5)).toEqual({
      code: "FR",
      id: 5,
      name: "France",
      segment: "",
    });
    expect(mockGetCachedCountries).toHaveBeenCalledWith("name");
  });

  it("falls back to empty code/name when the territory is not in the cached list", () => {
    mockGetCachedCountries.mockReturnValue([
      { value: 5, label: "France", code: "FR" },
    ]);
    expect(territoryDataFor(999)).toEqual({
      code: "",
      id: 999,
      name: "",
      segment: "",
    });
  });
});

describe("ownerFromProfile", () => {
  it("returns all defaults for undefined/null profile", () => {
    const defaults = {
      avatar: "",
      first_name: "",
      last_name: "",
      username: "",
      private: false,
      id: 0,
      timezone_id: "",
    };
    expect(ownerFromProfile(undefined)).toEqual(defaults);
    expect(ownerFromProfile(null)).toEqual(defaults);
  });

  it("maps a full profile including nested user_data", () => {
    expect(
      ownerFromProfile({
        avatar: "avatar.jpg",
        user_data: {
          first_name: "Jane",
          last_name: "Doe",
          username: "jdoe",
        },
        private: true,
        user: 42,
        timezone: "Europe/Berlin",
      } as never),
    ).toEqual({
      avatar: "avatar.jpg",
      first_name: "Jane",
      last_name: "Doe",
      username: "jdoe",
      private: true,
      id: 42,
      timezone_id: "Europe/Berlin",
    });
  });

  it("preserves an explicit user id of 0 rather than falling back to the default", () => {
    expect(ownerFromProfile({ user: 0 } as never).id).toBe(0);
  });
});
