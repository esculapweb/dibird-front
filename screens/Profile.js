import { StyleSheet, View } from "react-native";

import ProfileForm from "../components/Profile/ProfileForm";

const Profile = ({ data, submitHandler, loading }) => {

  return (
    <View style={styles.container}>
      <ProfileForm data={data} submitHandler={submitHandler} loading={loading}/>
    </View>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    margin: 24,
  },
});
