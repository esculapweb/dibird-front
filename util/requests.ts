import api from "../services/api";

interface ImageAsset {
  uri: string;
  width?: number;
  height?: number;
}

interface AvatarResponse {
  avatar_thumbnail: string;
}

export const patchAvatar = async (
  image: ImageAsset,
): Promise<AvatarResponse> => {
  const formData = new FormData();

  formData.append("avatar", {
    uri: image.uri,
    name: "avatar.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  try {
    const response = await api.patch<AvatarResponse>(
      "/myapi/profile/avatar/",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    if (response.status !== 200 && response.status !== 204)
      throw new Error(`Unexpected status code: ${response.status}`);

    return response.data;
  } catch (e) {
    throw e;
  }
};
