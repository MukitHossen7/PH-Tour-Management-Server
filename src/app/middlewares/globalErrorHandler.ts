/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import config from "../../config";
import AppError from "../errorHelpers/AppError";
import { deleteImageFromCLoudinary } from "../config/cloudinary.config";

interface IErrorSources {
  message: string;
  path: string;
}

export const globalErrorHandler = async (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.file) {
    await deleteImageFromCLoudinary(req.file.path);
  }
  if (req.files && Array.isArray(req.files) && req.files.length) {
    const fileUrl = (req.files as Express.Multer.File[])?.map(
      (file) => file.path
    );

    await Promise.all(fileUrl.map((url) => deleteImageFromCLoudinary(url)));
  }
  const errorSources: IErrorSources[] = [];
  let statusCode = 500;
  let message = "Something Went Wrong!!";

  //duplicate error
  if (error.code === 11000) {
    const matchArray = error.message.match(/"([^"]*)"/);
    statusCode = 400;
    message = `${matchArray[1]} already exists!!`;
  }
  // cast error
  else if (error.name === "CastError") {
    statusCode = 400;
    message = "Invalid MongoDB ObjectId. Please provide a valid id";
  }
  //mongoose validation error
  else if (error.name === "ValidationError") {
    statusCode = 400;
    const errors = Object.values(error.errors);
    errors.forEach((errorObject: any) =>
      errorSources.push({
        path: errorObject.path,
        message: errorObject.message,
      })
    );
    message = "Validation Error";
  }
  // zod validation error
  else if (error.name === "ZodError") {
    statusCode = 400;
    error.issues.forEach((issue: any) =>
      errorSources.push({
        path: issue.path[issue.path.length - 1],
        message: issue.message,
      })
    );
    message = "Zod Error";
  } else if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error instanceof Error) {
    statusCode = 500;
    message = error.message;
  }
  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    error: config.node_env === "development" ? error : null,
    stack: config.node_env === "development" ? error.stack : null,
  });
};
