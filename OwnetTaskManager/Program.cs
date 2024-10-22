using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.EntityFrameworkCore;
using OwnetTaskManager.Data;
using OwnetTaskManager.Interfaces;
using OwnetTaskManager.Repositories;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddAutoMapper(typeof(Program));
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<ITaskItemRepository, TaskItemRepository>();

if (builder.Environment.IsProduction())
{
    var keyVaultURL = builder.Configuration.GetSection("KeyVault:KeyVaultUrl").Value;

    try
    {
        var client = new SecretClient(new Uri(keyVaultURL), new DefaultAzureCredential());
        builder.Configuration.AddAzureKeyVault(new Uri(keyVaultURL), new DefaultAzureCredential());

        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(client.GetSecret("DefaultConnection").Value.Value));
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error accessing Key Vault: {ex.Message}");
        throw;
    }
}
else
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
}

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

await app.RunAsync();