import { useProfile } from "../store/profile-context";
import { mapErrorToToast } from "../services/api";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import Layout from "../components/ui/Layout";

const ErrorScreen = () => {
  const { error, refreshProfile } = useProfile();

  const { title, message } = mapErrorToToast(error);

  return (
    <Layout>
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
