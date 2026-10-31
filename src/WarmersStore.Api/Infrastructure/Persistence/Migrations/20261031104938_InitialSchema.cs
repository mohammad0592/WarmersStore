using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WarmersStore.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "cities",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    slug = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    display_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cities", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "custom_discount_tiers",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    min_items = table.Column<int>(type: "integer", nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    value = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_custom_discount_tiers", x => x.id);
                    table.CheckConstraint("ck_custom_discount_tiers_min_items_positive", "min_items > 0");
                    table.CheckConstraint("ck_custom_discount_tiers_value", "value > 0 AND (type <> 'Percent' OR value <= 100)");
                });

            migrationBuilder.CreateTable(
                name: "custom_package_settings",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    min_items = table.Column<int>(type: "integer", nullable: true),
                    max_items = table.Column<int>(type: "integer", nullable: true),
                    min_subtotal = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_custom_package_settings", x => x.id);
                    table.CheckConstraint("ck_custom_package_settings_item_range", "min_items IS NULL OR max_items IS NULL OR min_items <= max_items");
                    table.CheckConstraint("ck_custom_package_settings_limits_positive", "(min_items IS NULL OR min_items > 0) AND (max_items IS NULL OR max_items > 0) AND (min_subtotal IS NULL OR min_subtotal >= 0)");
                    table.CheckConstraint("ck_custom_package_settings_singleton", "id = 1");
                });

            migrationBuilder.CreateTable(
                name: "delivery_areas",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    fee = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    free_delivery_threshold = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    display_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    name = table.Column<string>(type: "jsonb", nullable: false),
                    note = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_delivery_areas", x => x.id);
                    table.CheckConstraint("ck_delivery_areas_amounts_non_negative", "fee >= 0 AND (free_delivery_threshold IS NULL OR free_delivery_threshold >= 0)");
                });

            migrationBuilder.CreateTable(
                name: "delivery_settings",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false),
                    mode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    flat_fee = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    free_delivery_threshold = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    message = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_delivery_settings", x => x.id);
                    table.CheckConstraint("ck_delivery_settings_amounts_non_negative", "(flat_fee IS NULL OR flat_fee >= 0) AND (free_delivery_threshold IS NULL OR free_delivery_threshold >= 0)");
                    table.CheckConstraint("ck_delivery_settings_singleton", "id = 1");
                });

            migrationBuilder.CreateTable(
                name: "packages",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    image_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_featured = table.Column<bool>(type: "boolean", nullable: false),
                    display_order = table.Column<int>(type: "integer", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    description = table.Column<string>(type: "jsonb", nullable: true),
                    name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_packages", x => x.id);
                    table.CheckConstraint("ck_ready_made_packages_price_non_negative", "price >= 0");
                });

            migrationBuilder.CreateTable(
                name: "products",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    width_cm = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: false),
                    height_cm = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: false),
                    heat_min_hours = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    heat_max_hours = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    is_adhesive = table.Column<bool>(type: "boolean", nullable: true),
                    pieces_per_retail_bag = table.Column<int>(type: "integer", nullable: false),
                    selling_unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    pieces_per_selling_unit = table.Column<int>(type: "integer", nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_custom_eligible = table.Column<bool>(type: "boolean", nullable: false),
                    display_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    description = table.Column<string>(type: "jsonb", nullable: true),
                    name = table.Column<string>(type: "jsonb", nullable: false),
                    safety_info = table.Column<string>(type: "jsonb", nullable: true),
                    short_description = table.Column<string>(type: "jsonb", nullable: true),
                    usage_guidance = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_products", x => x.id);
                    table.CheckConstraint("ck_products_dimensions_positive", "width_cm > 0 AND height_cm > 0");
                    table.CheckConstraint("ck_products_heat_range", "heat_min_hours IS NULL OR heat_max_hours IS NULL OR heat_min_hours <= heat_max_hours");
                    table.CheckConstraint("ck_products_pieces_positive", "pieces_per_retail_bag > 0 AND pieces_per_selling_unit > 0");
                    table.CheckConstraint("ck_products_unit_price_non_negative", "unit_price IS NULL OR unit_price >= 0");
                });

            migrationBuilder.CreateTable(
                name: "store_settings",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false),
                    store_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    logo_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    whats_app_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    address = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    facebook_url = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    instagram_url = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    tik_tok_url = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    announcement_active = table.Column<bool>(type: "boolean", nullable: false),
                    min_order_total = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    show_distributors = table.Column<bool>(type: "boolean", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    announcement = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_store_settings", x => x.id);
                    table.CheckConstraint("ck_store_settings_min_order_non_negative", "min_order_total IS NULL OR min_order_total >= 0");
                    table.CheckConstraint("ck_store_settings_singleton", "id = 1");
                });

            migrationBuilder.CreateTable(
                name: "distributors",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    city_id = table.Column<int>(type: "integer", nullable: false),
                    address = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    google_maps_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    latitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    longitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    image_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    display_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_distributors", x => x.id);
                    table.CheckConstraint("ck_distributors_coordinates_pair", "(latitude IS NULL) = (longitude IS NULL)");
                    table.CheckConstraint("ck_distributors_coordinates_range", "latitude IS NULL OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)");
                    table.ForeignKey(
                        name: "fk_distributors_cities_city_id",
                        column: x => x.city_id,
                        principalTable: "cities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "package_items",
                columns: table => new
                {
                    package_id = table.Column<int>(type: "integer", nullable: false),
                    product_id = table.Column<int>(type: "integer", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_package_items", x => new { x.package_id, x.product_id });
                    table.CheckConstraint("ck_package_items_quantity_positive", "quantity > 0");
                    table.ForeignKey(
                        name: "fk_package_items_packages_package_id",
                        column: x => x.package_id,
                        principalTable: "packages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_package_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "product_custom_rules",
                columns: table => new
                {
                    product_id = table.Column<int>(type: "integer", nullable: false),
                    min_qty = table.Column<int>(type: "integer", nullable: true),
                    max_qty = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_custom_rules", x => x.product_id);
                    table.CheckConstraint("ck_product_custom_rules_range", "(min_qty IS NULL OR min_qty > 0) AND (max_qty IS NULL OR max_qty > 0) AND (min_qty IS NULL OR max_qty IS NULL OR min_qty <= max_qty)");
                    table.ForeignKey(
                        name: "fk_product_custom_rules_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_images",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    product_id = table.Column<int>(type: "integer", nullable: false),
                    storage_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    alt_text = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_images", x => x.id);
                    table.ForeignKey(
                        name: "fk_product_images_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_cities_slug",
                table: "cities",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_distributors_city_id",
                table: "distributors",
                column: "city_id");

            migrationBuilder.CreateIndex(
                name: "ix_distributors_is_active_city_id_display_order",
                table: "distributors",
                columns: new[] { "is_active", "city_id", "display_order" });

            migrationBuilder.CreateIndex(
                name: "ix_package_items_product_id",
                table: "package_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_packages_slug",
                table: "packages",
                column: "slug",
                unique: true,
                filter: "deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_product_images_product_id_sort_order",
                table: "product_images",
                columns: new[] { "product_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_products_slug",
                table: "products",
                column: "slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "custom_discount_tiers");

            migrationBuilder.DropTable(
                name: "custom_package_settings");

            migrationBuilder.DropTable(
                name: "delivery_areas");

            migrationBuilder.DropTable(
                name: "delivery_settings");

            migrationBuilder.DropTable(
                name: "distributors");

            migrationBuilder.DropTable(
                name: "package_items");

            migrationBuilder.DropTable(
                name: "product_custom_rules");

            migrationBuilder.DropTable(
                name: "product_images");

            migrationBuilder.DropTable(
                name: "store_settings");

            migrationBuilder.DropTable(
                name: "cities");

            migrationBuilder.DropTable(
                name: "packages");

            migrationBuilder.DropTable(
                name: "products");
        }
    }
}
