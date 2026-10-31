using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WarmersStore.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CustomPackageMaxQuantityPerProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_custom_package_settings_limits_positive",
                table: "custom_package_settings");

            migrationBuilder.AddColumn<int>(
                name: "max_quantity_per_product",
                table: "custom_package_settings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_custom_package_settings_limits_positive",
                table: "custom_package_settings",
                sql: "(min_items IS NULL OR min_items > 0) AND (max_items IS NULL OR max_items > 0) AND (min_subtotal IS NULL OR min_subtotal >= 0) AND (max_quantity_per_product IS NULL OR max_quantity_per_product > 0)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_custom_package_settings_limits_positive",
                table: "custom_package_settings");

            migrationBuilder.DropColumn(
                name: "max_quantity_per_product",
                table: "custom_package_settings");

            migrationBuilder.AddCheckConstraint(
                name: "ck_custom_package_settings_limits_positive",
                table: "custom_package_settings",
                sql: "(min_items IS NULL OR min_items > 0) AND (max_items IS NULL OR max_items > 0) AND (min_subtotal IS NULL OR min_subtotal >= 0)");
        }
    }
}
