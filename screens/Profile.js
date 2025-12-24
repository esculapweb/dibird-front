import { StyleSheet, Text, View, Image } from "react-native";

import { Config } from "../constants/config";

const Profile = ({ data }) => {
  return (
    <View style={styles.container}>
      <Text>{data?.user_data?.username}</Text>
      <View style={styles.imageContainer}>
        {data?.avatar && (
          <Image
            source={{
              uri: `${Config.baseUrl}/media/${data.avatar}.150x150_q85_crop.jpg`,
            }}
            style={styles.image}
          />
        )}
      </View>
    </View>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  imageContainer: {
    width: 150,
    height: 150,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
