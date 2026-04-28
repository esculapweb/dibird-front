import { ReactNode } from "react";
import FlatButtonBottom from "./FlatButtonBottom";
import Layout from "./Layout";
import { StyleType } from "../../types";

interface FormWrapperProps {
  header?: ReactNode;
  bottomButtonLabel?: string;
  bottomButtonHandler?: () => void;
  style?: StyleType;
  children: ReactNode;
}

const FormWrapper = ({
  header,
  bottomButtonLabel,
  bottomButtonHandler,
  style,
  children,
}: FormWrapperProps) => {
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
