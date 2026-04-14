import FlatButtonBottom from "./FlatButtonBottom";
import Layout from "./Layout";

const FormWrapper = ({
  header,
  bottomButtonLabel,
  bottomButtonHandler,
  style,
  children,
}) => {
  const bottomEl = bottomButtonLabel && (
    <FlatButtonBottom onPress={bottomButtonHandler}>
      {bottomButtonLabel}
    </FlatButtonBottom>
  );

  return (
    <Layout
      withKeyboard={true}
      top={header}
      bottom={bottomEl}
      style={[style, { paddingHorizontal: 24 }]}
    >
      {children}
    </Layout>
  );
};

export default FormWrapper;
