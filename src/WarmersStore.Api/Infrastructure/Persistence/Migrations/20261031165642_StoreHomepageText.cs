using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WarmersStore.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StoreHomepageText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "homepage",
                table: "store_settings",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "homepage",
                table: "store_settings");
        }
    }
}
