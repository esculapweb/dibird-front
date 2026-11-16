import { useProfile } from "../store/profile-context";
import { toUIError } from "../services/errors";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import Layout from "../components/ui/Layout";

const ErrorScreen = () => {
  const { error, refreshProfile } = useProfile();
  if (!error) return null;
  const { title, message } = toUIError(error);

  return (
    // Scrolls only when the content doesn't fit (landscape, large font);
    // flexGrow keeps it centred otherwise.
    <Layout withScroll contentContainerStyle={{ flexGrow: 1 }}>
      <ErrorOverlay
        title={title}
        message={message}
        onPress={refreshProfile}
        logo
      />
    </Layout>
  );
};

export default ErrorScreen;
