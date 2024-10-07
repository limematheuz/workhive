using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration.AzureKeyVault;
using OwnetTaskManager.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

if (builder.Environment.IsProduction())
{
    var keyVaultURL = builder.Configuration.GetSection("KeyVault:keyVaultURL");
    var keyVaultClientId = builder.Configuration.GetSection("KeyVault:keyVaultClientId");
    var keyVaultClientSecret = builder.Configuration.GetSection("KeyVault:keyVaultClientSecret");
    var keyVaultDirectoryID = builder.Configuration.GetSection("KeyVault:keyVaultDirectoryID");

    var credential = new ClientSecretCredential(keyVaultClientId.Value!.ToString(),
        keyVaultClientSecret.Value!.ToString(), keyVaultDirectoryID.Value!.ToString());

    builder.Configuration.AddAzureKeyVault(keyVaultURL.Value!.ToString(), keyVaultClientSecret.Value!.ToString(),
        keyVaultClientId.Value!.ToString(), new DefaultKeyVaultSecretManager());

    var client = new SecretClient(new Uri(keyVaultURL.Value!.ToString()), credential);

    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(client.GetSecret("ProductionConnection").Value.Value).ToString());
}

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
}


var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.Run();