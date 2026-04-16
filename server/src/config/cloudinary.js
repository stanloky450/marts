import { v2 as cloudinary } from "cloudinary";
import { config } from "./env.js";

cloudinary.config({
	cloud_name: config.cloudinary.cloudName,
	api_key: config.cloudinary.apiKey,
	api_secret: config.cloudinary.apiSecret,
});

export default cloudinary;

// export const uploadToCloud = async (buffer, filename) => {
// 	return new Promise((resolve, reject) => {
// 		const uploadStream = cloudinary.uploader.upload_stream(
// 			{ folder: "vendors", public_id: filename.split(".")[0] },
// 			(error, result) => {
// 				if (error) return reject(error);
// 				resolve(result.secure_url);
// 			}
// 		);

// 		uploadStream.end(buffer);

export const uploadToCloud = async (buffer, filename) => {
	return new Promise((resolve, reject) => {
	  const safeName = filename?.split(".")[0] || `file_${Date.now()}`;
  
	  const uploadStream = cloudinary.uploader.upload_stream(
		{ folder: "vendors", public_id: safeName },
		(error, result) => {
		  if (error) return reject(error);
		  resolve(result.secure_url);
		}
	  );
  
	  uploadStream.end(buffer);
	});
// 	});
};
