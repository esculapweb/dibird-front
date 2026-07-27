jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => (
      <View>{children}</View>
    ),
  };
});
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("../../hooks/Profile/useImportObservations", () => ({
  useImportObservations: () => mockImportHook,
}));
jest.mock("../../services/errors", () => ({ logError: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";

import { ObservationImport, ObservationImportStatus } from "../../types";
import ImportScreen from "../ImportScreen";

const mockGetDocument = DocumentPicker.getDocumentAsync as jest.Mock;
const mockStartImport = jest.fn();
const mockReset = jest.fn();

let mockImportHook: {
  state: ObservationImportStatus;
  result: ObservationImport | null;
  startImport: jest.Mock;
  reset: jest.Mock;
};

const RESULT = (overrides: Partial<ObservationImport> = {}): ObservationImport => ({
  id: 1,
  status: "completed",
  source: "ebird",
  make_public: false,
  total: 120,
  imported: 117,
  skipped: 3,
  unmatched: [],
  created_at: "2026-07-27T10:00:00Z",
  finished_at: "2026-07-27T10:01:00Z",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockImportHook = {
    state: "idle",
    result: null,
    startImport: mockStartImport,
    reset: mockReset,
  };
  mockGetDocument.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///tmp/MyEBirdData.csv", name: "MyEBirdData.csv" }],
  });
});

describe("picking a file", () => {
  it("sends the chosen file to the import", async () => {
    await render(<ImportScreen />);
    await fireEvent.press(screen.getByTestId("import-action"));

    expect(mockStartImport).toHaveBeenCalledWith(
      { uri: "file:///tmp/MyEBirdData.csv", name: "MyEBirdData.csv" },
      false,
    );
  });

  it("passes the community switch along", async () => {
    await render(<ImportScreen />);
    await fireEvent(screen.getByTestId("import-public-switch"), "valueChange", true);
    await fireEvent.press(screen.getByTestId("import-action"));

    expect(mockStartImport).toHaveBeenCalledWith(expect.anything(), true);
  });

  it("does nothing when the picker was dismissed", async () => {
    mockGetDocument.mockResolvedValue({ canceled: true, assets: null });

    await render(<ImportScreen />);
    await fireEvent.press(screen.getByTestId("import-action"));

    expect(mockStartImport).not.toHaveBeenCalled();
  });
});

describe("while the import runs", () => {
  // Кнопка убрана намеренно: задача живёт на бэке, второй запрос упёрся бы в
  // 429, а поллинг подхватится сам при следующем заходе на экран.
  it.each(["pending", "processing"] as const)(
    "shows progress and no action button — %s",
    async (state) => {
      mockImportHook.state = state;

      await render(<ImportScreen />);

      expect(screen.getByTestId("import-progress")).toBeOnTheScreen();
      expect(screen.queryByTestId("import-action")).not.toBeOnTheScreen();
      expect(screen.queryByTestId("import-public-switch")).not.toBeOnTheScreen();
    },
  );
});

describe("the report", () => {
  it("shows how much of the file made it in", async () => {
    mockImportHook.state = "completed";
    mockImportHook.result = RESULT();

    await render(<ImportScreen />);

    expect(screen.getByTestId("import-result")).toBeOnTheScreen();
    expect(
      screen.getByText('import_done_text:{"imported":117,"total":120}'),
    ).toBeOnTheScreen();
  });

  // Список нераспознанных — единственный способ для человека понять, потерял
  // ли он что-то важное или это устаревшие синонимы.
  it("lists the names that were not recognised", async () => {
    mockImportHook.state = "completed";
    mockImportHook.result = RESULT({ unmatched: ["Carduelis chloris"] });

    await render(<ImportScreen />);

    expect(screen.getByText("Carduelis chloris")).toBeOnTheScreen();
    expect(screen.getByText("import_unmatched_title")).toBeOnTheScreen();
  });

  it("keeps the block out of the way when everything matched", async () => {
    mockImportHook.state = "completed";
    mockImportHook.result = RESULT();

    await render(<ImportScreen />);

    expect(screen.queryByText("import_unmatched_title")).not.toBeOnTheScreen();
  });

  it("returns to the start from the report", async () => {
    mockImportHook.state = "completed";
    mockImportHook.result = RESULT();

    await render(<ImportScreen />);
    await fireEvent.press(screen.getByTestId("import-action"));

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockGetDocument).not.toHaveBeenCalled();
  });

  it("explains a failure instead of a report", async () => {
    mockImportHook.state = "failed";

    await render(<ImportScreen />);

    expect(screen.getByTestId("import-failed")).toBeOnTheScreen();
    expect(screen.queryByTestId("import-result")).not.toBeOnTheScreen();
  });
});
