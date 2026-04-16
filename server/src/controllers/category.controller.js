import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";
import prisma from "../lib/prisma.js";

export const createCategory = async (req, res, next) => {
	try {
		const { name, slug, parent, icon, status } = req.body;

		// Check if category already exists
		const existing = await prisma.category.findFirst({
			where: { OR: [{ name }, { slug }] }
		});
		if (existing) {
			return res
				.status(409)
				.json(
					errorResponse(
						"CATEGORY_EXISTS",
						"Category with this name or slug already exists"
					)
				);
		}

		const crypto = await import('crypto');
		const mongoId = crypto.randomBytes(12).toString('hex');

		const category = await prisma.category.create({
			data: {
				mongoId,
				name,
				slug,
				parentMongoId: parent,
				icon,
				status,
				// createdBy: req.user.id,
			}
		});

		logger.info(`Category created: ${category.id}`);

		res.status(201).json(successResponse({ ...category, _id: category.mongoId }));
	} catch (error) {
		next(error);
	}
};

export const listCategories = async (req, res, next) => {
	try {
		const { parent } = req.query;

		const where = {};

		if (parent === "null" || parent === "none") {
			where.parentMongoId = null;
		} else if (parent) {
			where.parentMongoId = parent;
		}

		const categories = await prisma.category.findMany({
			where,
			include: {
				parent: { select: { name: true, slug: true, mongoId: true } }
			},
			orderBy: { name: 'asc' }
		});

		const mappedCategories = categories.map(c => ({
			...c,
			_id: c.mongoId,
			parent: c.parent ? { ...c.parent, _id: c.parent.mongoId } : null
		}));

		res.json(successResponse(mappedCategories));
	} catch (error) {
		next(error);
	}
};

export const getCategory = async (req, res, next) => {
	try {
		const { id } = req.params;

		const category = await prisma.category.findFirst({
			where: { OR: [{ mongoId: id }, { id: id }] },
			include: {
				parent: { select: { name: true, slug: true, mongoId: true } }
			}
		});

		if (!category) {
			return res
				.status(404)
				.json(errorResponse("CATEGORY_NOT_FOUND", "Category not found"));
		}

		res.json(successResponse({
			...category,
			_id: category.mongoId,
			parent: category.parent ? { ...category.parent, _id: category.parent.mongoId } : null
		}));
	} catch (error) {
		next(error);
	}
};

export const updateCategory = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { name, slug, parent, icon, status } = req.body;

		const category = await prisma.category.findFirst({
			where: { OR: [{ mongoId: id }, { id: id }] }
		});

		if (!category) {
			return res
				.status(404)
				.json(errorResponse("CATEGORY_NOT_FOUND", "Category not found"));
		}

		const updateData = {};
		if (name) updateData.name = name;
		if (slug) updateData.slug = slug;
		if (parent !== undefined) updateData.parentMongoId = parent;
		if (icon !== undefined) updateData.icon = icon;
		if (status) updateData.status = status;

		const updatedCategory = await prisma.category.update({
			where: { id: category.id },
			data: updateData
		});

		logger.info(`Category updated: ${id}`);

		res.json(successResponse({ ...updatedCategory, _id: updatedCategory.mongoId }));
	} catch (error) {
		next(error);
	}
};

export const deleteCategory = async (req, res, next) => {
	try {
		const { id } = req.params;

		const category = await prisma.category.findFirst({
			where: { OR: [{ mongoId: id }, { id: id }] }
		});

		if (!category) {
			return res
				.status(404)
				.json(errorResponse("CATEGORY_NOT_FOUND", "Category not found"));
		}

		// Check if category has children
		const childCount = await prisma.category.count({
			where: { parentMongoId: category.mongoId }
		});
		if (childCount > 0) {
			return res
				.status(400)
				.json(
					errorResponse(
						"CATEGORY_HAS_CHILDREN",
						"Cannot delete category with subcategories"
					)
				);
		}

		await prisma.category.delete({
			where: { id: category.id }
		});

		logger.info(`Category deleted: ${id}`);

		res.json(successResponse({ message: "Category deleted successfully" }));
	} catch (error) {
		next(error);
	}
};
