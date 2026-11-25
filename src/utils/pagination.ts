import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

export interface PaginationOptions {
    page?: number;
    limit?: number;
}

export interface PaginatedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export async function paginate<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    options: PaginationOptions
): Promise<PaginatedResult<T>> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, options.limit || 10);
    const skip = (page - 1) * limit;

    const [data, total] = await queryBuilder
        .skip(skip)
        .take(limit)
        .getManyAndCount();

    return {
        data,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}
